import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid project ID", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id: projectId } = parsed.data;

    const client = await pool.connect();
    try {
      // Verify project exists and user has access
      const projectResult = await client.query(
        `SELECT id, name, owner_id FROM projects WHERE id = $1`,
        [projectId],
      );

      if (projectResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }

      // Fetch all bids for the project
      const bidsResult = await client.query(
        `SELECT 
          b.id,
          b.project_id,
          b.bidder_name,
          b.bidder_email,
          b.status,
          b.submitted_at,
          b.notes,
          b.created_at,
          b.updated_at
        FROM bids b
        WHERE b.project_id = $1
        ORDER BY b.created_at ASC`,
        [projectId],
      );

      const bids = bidsResult.rows;

      if (bids.length === 0) {
        return NextResponse.json({
          project: projectResult.rows[0],
          bids: [],
          comparison: {
            line_items: [],
            bidder_totals: [],
            summary: {
              total_bidders: 0,
              lowest_total: null,
              highest_total: null,
              average_total: null,
            },
          },
        });
      }

      const bidIds = bids.map((b) => b.id);

      // Fetch all bid_line_items for these bids
      const lineItemsResult = await client.query(
        `SELECT 
          bli.id,
          bli.bid_id,
          bli.description,
          bli.quantity,
          bli.unit,
          bli.unit_price,
          bli.total_price,
          bli.category,
          bli.sort_order,
          bli.created_at
        FROM bid_line_items bli
        WHERE bli.bid_id = ANY($1::uuid[])
        ORDER BY bli.category ASC, bli.sort_order ASC, bli.description ASC`,
        [bidIds],
      );

      const lineItems = lineItemsResult.rows;

      // Group line items by bid_id
      const lineItemsByBid: Record<string, typeof lineItems> = {};
      for (const item of lineItems) {
        if (!lineItemsByBid[item.bid_id]) {
          lineItemsByBid[item.bid_id] = [];
        }
        lineItemsByBid[item.bid_id].push(item);
      }

      // Compute per-bid totals
      const bidderTotals = bids.map((bid) => {
        const items = lineItemsByBid[bid.id] || [];
        const total = items.reduce((sum, item) => {
          const price = parseFloat(item.total_price) || 0;
          return sum + price;
        }, 0);
        return {
          bid_id: bid.id,
          bidder_name: bid.bidder_name,
          bidder_email: bid.bidder_email,
          status: bid.status,
          submitted_at: bid.submitted_at,
          total: total,
          line_item_count: items.length,
        };
      });

      // Compute summary statistics
      const totals = bidderTotals.map((b) => b.total);
      const lowestTotal = totals.length > 0 ? Math.min(...totals) : null;
      const highestTotal = totals.length > 0 ? Math.max(...totals) : null;
      const averageTotal =
        totals.length > 0
          ? totals.reduce((sum, t) => sum + t, 0) / totals.length
          : null;

      // Build line-item breakdown by category and description
      // Collect all unique categories and descriptions
      const categoryMap: Record<
        string,
        Record<
          string,
          {
            description: string;
            category: string;
            bids: Record<
              string,
              {
                quantity: number | null;
                unit: string | null;
                unit_price: number | null;
                total_price: number | null;
              }
            >;
          }
        >
      > = {};

      for (const item of lineItems) {
        const category = item.category || "Uncategorized";
        const description = item.description;

        if (!categoryMap[category]) {
          categoryMap[category] = {};
        }

        if (!categoryMap[category][description]) {
          categoryMap[category][description] = {
            description,
            category,
            bids: {},
          };
        }

        categoryMap[category][description].bids[item.bid_id] = {
          quantity: item.quantity !== null ? parseFloat(item.quantity) : null,
          unit: item.unit,
          unit_price:
            item.unit_price !== null ? parseFloat(item.unit_price) : null,
          total_price:
            item.total_price !== null ? parseFloat(item.total_price) : null,
        };
      }

      // Convert to array format
      const lineItemBreakdown = Object.entries(categoryMap).map(
        ([category, descriptions]) => ({
          category,
          items: Object.values(descriptions).map((item) => {
            const bidPrices = bids.map((bid) => ({
              bid_id: bid.id,
              bidder_name: bid.bidder_name,
              ...(item.bids[bid.id] || {
                quantity: null,
                unit: null,
                unit_price: null,
                total_price: null,
              }),
            }));

            const prices = bidPrices
              .map((b) => b.total_price)
              .filter((p): p is number => p !== null);

            return {
              description: item.description,
              category: item.category,
              bids: bidPrices,
              lowest_price: prices.length > 0 ? Math.min(...prices) : null,
              highest_price: prices.length > 0 ? Math.max(...prices) : null,
              average_price:
                prices.length > 0
                  ? prices.reduce((sum, p) => sum + p, 0) / prices.length
                  : null,
            };
          }),
        }),
      );

      return NextResponse.json({
        project: projectResult.rows[0],
        bids: bids.map((bid) => ({
          ...bid,
          line_items: lineItemsByBid[bid.id] || [],
        })),
        comparison: {
          line_items: lineItemBreakdown,
          bidder_totals: bidderTotals,
          summary: {
            total_bidders: bids.length,
            lowest_total: lowestTotal,
            highest_total: highestTotal,
            average_total: averageTotal,
            lowest_bidder:
              lowestTotal !== null
                ? bidderTotals.find((b) => b.total === lowestTotal) || null
                : null,
            highest_bidder:
              highestTotal !== null
                ? bidderTotals.find((b) => b.total === highestTotal) || null
                : null,
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching bid comparison:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
