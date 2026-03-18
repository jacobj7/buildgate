"use client";

import React, { useCallback, useEffect, useState } from "react";

export interface BidLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface BidLineItemTableProps {
  initialItems?: BidLineItem[];
  onChange?: (items: BidLineItem[]) => void;
  readOnly?: boolean;
}

const UNIT_OPTIONS = [
  "ea",
  "hr",
  "day",
  "wk",
  "mo",
  "ft",
  "ft²",
  "ft³",
  "yd",
  "yd²",
  "yd³",
  "m",
  "m²",
  "m³",
  "lb",
  "ton",
  "gal",
  "ls",
  "lot",
];

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyItem(): BidLineItem {
  return {
    id: generateId(),
    description: "",
    quantity: 1,
    unit: "ea",
    unit_price: 0,
    total: 0,
  };
}

function calculateTotal(quantity: number, unit_price: number): number {
  const qty = isNaN(quantity) ? 0 : quantity;
  const price = isNaN(unit_price) ? 0 : unit_price;
  return Math.round(qty * price * 100) / 100;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function BidLineItemTable({
  initialItems,
  onChange,
  readOnly = false,
}: BidLineItemTableProps) {
  const [items, setItems] = useState<BidLineItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        ...item,
        total: calculateTotal(item.quantity, item.unit_price),
      }));
    }
    return [createEmptyItem()];
  });

  const runningTotal = items.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => {
    onChange?.(items);
  }, [items, onChange]);

  const updateItem = useCallback(
    (id: string, field: keyof BidLineItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;

          const updated = { ...item, [field]: value };

          if (field === "quantity" || field === "unit_price") {
            const qty = field === "quantity" ? Number(value) : item.quantity;
            const price =
              field === "unit_price" ? Number(value) : item.unit_price;
            updated.total = calculateTotal(qty, price);
          }

          return updated;
        }),
      );
    },
    [],
  );

  const addRow = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        return [createEmptyItem()];
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const duplicateRow = useCallback((id: string) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const original = prev[index];
      const duplicate: BidLineItem = {
        ...original,
        id: generateId(),
      };
      const next = [...prev];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  }, []);

  const moveRow = useCallback((id: string, direction: "up" | "down") => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            {!readOnly && (
              <th className="w-8 border-b border-gray-200 px-2 py-3 text-center">
                #
              </th>
            )}
            <th className="border-b border-gray-200 px-4 py-3">Description</th>
            <th className="w-24 border-b border-gray-200 px-4 py-3 text-right">
              Qty
            </th>
            <th className="w-24 border-b border-gray-200 px-4 py-3">Unit</th>
            <th className="w-32 border-b border-gray-200 px-4 py-3 text-right">
              Unit Price
            </th>
            <th className="w-32 border-b border-gray-200 px-4 py-3 text-right">
              Total
            </th>
            {!readOnly && (
              <th className="w-28 border-b border-gray-200 px-2 py-3 text-center">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id}
              className="group border-b border-gray-100 transition-colors hover:bg-blue-50/30"
            >
              {!readOnly && (
                <td className="px-2 py-2 text-center text-xs text-gray-400">
                  {index + 1}
                </td>
              )}

              {/* Description */}
              <td className="px-4 py-2">
                {readOnly ? (
                  <span className="text-gray-800">{item.description}</span>
                ) : (
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, "description", e.target.value)
                    }
                    placeholder="Enter description..."
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-gray-800 placeholder-gray-400 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                )}
              </td>

              {/* Quantity */}
              <td className="px-4 py-2 text-right">
                {readOnly ? (
                  <span className="text-gray-800">
                    {item.quantity.toLocaleString()}
                  </span>
                ) : (
                  <input
                    type="number"
                    value={item.quantity}
                    min={0}
                    step="any"
                    onChange={(e) =>
                      updateItem(
                        item.id,
                        "quantity",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-right text-gray-800 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                )}
              </td>

              {/* Unit */}
              <td className="px-4 py-2">
                {readOnly ? (
                  <span className="text-gray-800">{item.unit}</span>
                ) : (
                  <select
                    value={item.unit}
                    onChange={(e) =>
                      updateItem(item.id, "unit", e.target.value)
                    }
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-gray-800 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                )}
              </td>

              {/* Unit Price */}
              <td className="px-4 py-2 text-right">
                {readOnly ? (
                  <span className="text-gray-800">
                    {formatCurrency(item.unit_price)}
                  </span>
                ) : (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={item.unit_price}
                      min={0}
                      step="0.01"
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "unit_price",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-full rounded border border-transparent bg-transparent py-1 pl-5 pr-2 text-right text-gray-800 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}
              </td>

              {/* Total */}
              <td className="px-4 py-2 text-right font-medium text-gray-900">
                {formatCurrency(item.total)}
              </td>

              {/* Actions */}
              {!readOnly && (
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveRow(item.id, "up")}
                      disabled={index === 0}
                      title="Move up"
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(item.id, "down")}
                      disabled={index === items.length - 1}
                      title="Move down"
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateRow(item.id)}
                      title="Duplicate row"
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(item.id)}
                      title="Remove row"
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>

        {/* Footer */}
        <tfoot>
          {!readOnly && (
            <tr>
              <td
                colSpan={readOnly ? 5 : 7}
                className="border-t border-gray-100 px-4 py-2"
              >
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Line Item
                </button>
              </td>
            </tr>
          )}
          <tr className="bg-gray-50">
            <td
              colSpan={readOnly ? 4 : 5}
              className="border-t border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700"
            >
              Running Total
            </td>
            <td className="border-t border-gray-200 px-4 py-3 text-right text-base font-bold text-gray-900">
              {formatCurrency(runningTotal)}
            </td>
            {!readOnly && <td className="border-t border-gray-200 px-2 py-3" />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
