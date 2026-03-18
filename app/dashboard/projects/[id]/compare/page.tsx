"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface LineItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
}

interface BidLineItem {
  lineItemId: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Bidder {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  submittedAt: string;
  totalAmount: number;
  lineItems: BidLineItem[];
}

interface CompareData {
  projectId: string;
  projectName: string;
  lineItems: LineItem[];
  bidders: Bidder[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getLowestBidderIndex(bidders: Bidder[]): number {
  if (bidders.length === 0) return -1;
  let lowestIndex = 0;
  let lowestAmount = bidders[0].totalAmount;
  for (let i = 1; i < bidders.length; i++) {
    if (bidders[i].totalAmount < lowestAmount) {
      lowestAmount = bidders[i].totalAmount;
      lowestIndex = i;
    }
  }
  return lowestIndex;
}

function getLowestPriceForLineItem(
  bidders: Bidder[],
  lineItemId: string,
): number {
  let lowest = Infinity;
  for (const bidder of bidders) {
    const item = bidder.lineItems.find((li) => li.lineItemId === lineItemId);
    if (item && item.totalPrice < lowest) {
      lowest = item.totalPrice;
    }
  }
  return lowest === Infinity ? 0 : lowest;
}

export default function BidComparePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompareData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/bids/compare`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Failed to fetch comparison data (${response.status})`,
        );
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCompareData();
  }, [fetchCompareData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 text-lg">Loading bid comparison...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full p-4 inline-block mb-4">
            <svg
              className="h-12 w-12 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchCompareData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const lowestBidderIndex = getLowestBidderIndex(data.bidders);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Bid Comparison
                </h1>
                <p className="text-sm text-gray-500">{data.projectName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                <span className="font-medium text-gray-900">
                  {data.bidders.length}
                </span>{" "}
                bid{data.bidders.length !== 1 ? "s" : ""} received
              </div>
              <button
                onClick={fetchCompareData}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {data.bidders.length === 0 ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="bg-gray-100 rounded-full p-6 inline-block mb-4">
              <svg
                className="h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Bids Yet
            </h2>
            <p className="text-gray-500">
              No bids have been submitted for this project.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6">
          {/* Legend */}
          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
              <span className="text-sm text-gray-600">Lowest price</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-50 border border-blue-200"></div>
              <span className="text-sm text-gray-600">Lowest total bid</span>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  {/* Bidder Header Row */}
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 bg-gray-50 z-10 text-left px-6 py-4 text-sm font-semibold text-gray-700 min-w-[280px] border-r border-gray-200">
                      Line Item
                    </th>
                    <th className="sticky left-[280px] bg-gray-50 z-10 text-center px-4 py-4 text-sm font-semibold text-gray-700 min-w-[100px] border-r border-gray-200">
                      Qty / Unit
                    </th>
                    {data.bidders.map((bidder, index) => (
                      <th
                        key={bidder.id}
                        className={`text-center px-4 py-4 min-w-[180px] border-r border-gray-200 last:border-r-0 ${
                          index === lowestBidderIndex
                            ? "bg-blue-50"
                            : "bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          {index === lowestBidderIndex && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white mb-1">
                              <svg
                                className="h-3 w-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Lowest Bid
                            </span>
                          )}
                          <span className="text-sm font-semibold text-gray-900">
                            {bidder.companyName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {bidder.contactName}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(bidder.submittedAt)}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Line Item Rows */}
                  {data.lineItems.map((lineItem, rowIndex) => {
                    const lowestPrice = getLowestPriceForLineItem(
                      data.bidders,
                      lineItem.id,
                    );
                    return (
                      <tr
                        key={lineItem.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="sticky left-0 z-10 px-6 py-4 border-r border-gray-200 bg-inherit">
                          <span className="text-sm font-medium text-gray-900">
                            {lineItem.description}
                          </span>
                        </td>
                        <td className="sticky left-[280px] z-10 px-4 py-4 text-center border-r border-gray-200 bg-inherit">
                          <div className="text-sm text-gray-700">
                            <span className="font-medium">
                              {lineItem.quantity}
                            </span>
                            <span className="text-gray-400 ml-1">
                              {lineItem.unit}
                            </span>
                          </div>
                        </td>
                        {data.bidders.map((bidder, bidderIndex) => {
                          const bidLineItem = bidder.lineItems.find(
                            (li) => li.lineItemId === lineItem.id,
                          );
                          const isLowest =
                            bidLineItem &&
                            bidLineItem.totalPrice === lowestPrice &&
                            lowestPrice > 0;
                          const isLowestBidder =
                            bidderIndex === lowestBidderIndex;

                          return (
                            <td
                              key={bidder.id}
                              className={`px-4 py-4 text-center border-r border-gray-100 last:border-r-0 ${
                                isLowest
                                  ? "bg-green-50"
                                  : isLowestBidder
                                    ? "bg-blue-50/30"
                                    : ""
                              }`}
                            >
                              {bidLineItem ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span
                                    className={`text-sm font-semibold ${
                                      isLowest
                                        ? "text-green-700"
                                        : "text-gray-900"
                                    }`}
                                  >
                                    {formatCurrency(bidLineItem.totalPrice)}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {formatCurrency(bidLineItem.unitPrice)} /{" "}
                                    {bidLineItem.unit}
                                  </span>
                                  {isLowest && (
                                    <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium">
                                      <svg
                                        className="h-3 w-3"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      Best
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-300 italic">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Totals Row */}
                  <tr className="bg-gray-900 border-t-2 border-gray-700">
                    <td className="sticky left-0 z-10 px-6 py-5 bg-gray-900 border-r border-gray-700">
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        Total Bid Amount
                      </span>
                    </td>
                    <td className="sticky left-[280px] z-10 px-4 py-5 bg-gray-900 border-r border-gray-700"></td>
                    {data.bidders.map((bidder, index) => {
                      const isLowest = index === lowestBidderIndex;
                      return (
                        <td
                          key={bidder.id}
                          className={`px-4 py-5 text-center border-r border-gray-700 last:border-r-0 ${
                            isLowest ? "bg-blue-600" : "bg-gray-900"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`text-lg font-bold ${
                                isLowest ? "text-white" : "text-gray-100"
                              }`}
                            >
                              {formatCurrency(bidder.totalAmount)}
                            </span>
                            {isLowest && (
                              <span className="text-xs text-blue-200 font-medium">
                                Recommended
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-100 rounded-lg p-2">
                  <svg
                    className="h-5 w-5 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Lowest Bid</h3>
              </div>
              {data.bidders[lowestBidderIndex] && (
                <>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(
                      data.bidders[lowestBidderIndex].totalAmount,
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {data.bidders[lowestBidderIndex].companyName}
                  </p>
                </>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-orange-100 rounded-lg p-2">
                  <svg
                    className="h-5 w-5 text-orange-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Highest Bid</h3>
              </div>
              {data.bidders.length > 0 &&
                (() => {
                  const highestBidder = data.bidders.reduce((prev, curr) =>
                    curr.totalAmount > prev.totalAmount ? curr : prev,
                  );
                  return (
                    <>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(highestBidder.totalAmount)}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {highestBidder.companyName}
                      </p>
                    </>
                  );
                })()}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-purple-100 rounded-lg p-2">
                  <svg
                    className="h-5 w-5 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Average Bid</h3>
              </div>
              {data.bidders.length > 0 && (
                <>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(
                      data.bidders.reduce((sum, b) => sum + b.totalAmount, 0) /
                        data.bidders.length,
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Across {data.bidders.length} bid
                    {data.bidders.length !== 1 ? "s" : ""}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Spread Analysis */}
          {data.bidders.length >= 2 &&
            (() => {
              const lowest = Math.min(
                ...data.bidders.map((b) => b.totalAmount),
              );
              const highest = Math.max(
                ...data.bidders.map((b) => b.totalAmount),
              );
              const spread = highest - lowest;
              const spreadPercent =
                lowest > 0 ? ((spread / lowest) * 100).toFixed(1) : "0";

              return (
                <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Bid Spread Analysis
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{formatCurrency(lowest)}</span>
                        <span>{formatCurrency(highest)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-orange-400 rounded-full"
                          style={{ width: "100%" }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Lowest</span>
                        <span>Highest</span>
                      </div>
                    </div>
                    <div className="text-right min-w-[140px]">
                      <p className="text-sm text-gray-500">Spread</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(spread)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {spreadPercent}% variance
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
