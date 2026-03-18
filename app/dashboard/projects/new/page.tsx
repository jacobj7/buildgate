"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    bid_due_date: "",
    budget: "",
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Project name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Project name must be at least 2 characters";
    }

    if (formData.description && formData.description.length > 5000) {
      newErrors.description = "Description must be 5000 characters or fewer";
    }

    if (formData.bid_due_date) {
      const date = new Date(formData.bid_due_date);
      if (isNaN(date.getTime())) {
        newErrors.bid_due_date = "Please enter a valid date";
      }
    }

    if (formData.budget) {
      const budget = parseFloat(formData.budget);
      if (isNaN(budget) || budget < 0) {
        newErrors.budget = "Budget must be a positive number";
      }
    }

    return newErrors;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
      };

      if (formData.description.trim()) {
        payload.description = formData.description.trim();
      }

      if (formData.bid_due_date) {
        payload.bid_due_date = formData.bid_due_date;
      }

      if (formData.budget) {
        payload.budget = parseFloat(formData.budget);
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 422 && data.errors) {
          setErrors(data.errors);
        } else {
          setServerError(
            data.error ||
              data.message ||
              "Failed to create project. Please try again.",
          );
        }
        return;
      }

      const projectId = data.id || data.project?.id;
      if (projectId) {
        router.push(`/dashboard/projects/${projectId}`);
      } else {
        router.push("/dashboard/projects");
      }
    } catch (err) {
      setServerError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link
              href="/dashboard"
              className="hover:text-gray-700 transition-colors"
            >
              Dashboard
            </Link>
            <span>/</span>
            <Link
              href="/dashboard/projects"
              className="hover:text-gray-700 transition-colors"
            >
              Projects
            </Link>
            <span>/</span>
            <span className="text-gray-900">New Project</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            Create New Project
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Fill in the details below to create a new project.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Project Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter project name"
                disabled={isSubmitting}
                className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors ${
                  errors.name
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300"
                }`}
                aria-describedby={errors.name ? "name-error" : undefined}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the project scope, goals, and requirements..."
                rows={5}
                disabled={isSubmitting}
                className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-vertical transition-colors ${
                  errors.description
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300"
                }`}
                aria-describedby={
                  errors.description ? "description-error" : undefined
                }
                aria-invalid={!!errors.description}
              />
              <div className="mt-1 flex justify-between items-center">
                {errors.description ? (
                  <p id="description-error" className="text-sm text-red-600">
                    {errors.description}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400">
                  {formData.description.length}/5000
                </span>
              </div>
            </div>

            {/* Bid Due Date and Budget Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Bid Due Date */}
              <div>
                <label
                  htmlFor="bid_due_date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Bid Due Date
                </label>
                <input
                  type="date"
                  id="bid_due_date"
                  name="bid_due_date"
                  value={formData.bid_due_date}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors ${
                    errors.bid_due_date
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                  aria-describedby={
                    errors.bid_due_date ? "bid_due_date-error" : undefined
                  }
                  aria-invalid={!!errors.bid_due_date}
                />
                {errors.bid_due_date && (
                  <p
                    id="bid_due_date-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {errors.bid_due_date}
                  </p>
                )}
              </div>

              {/* Budget */}
              <div>
                <label
                  htmlFor="budget"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Budget
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    id="budget"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    disabled={isSubmitting}
                    className={`w-full pl-7 pr-3 py-2 border rounded-md shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors ${
                      errors.budget
                        ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                        : "border-gray-300"
                    }`}
                    aria-describedby={
                      errors.budget ? "budget-error" : undefined
                    }
                    aria-invalid={!!errors.budget}
                  />
                </div>
                {errors.budget && (
                  <p id="budget-error" className="mt-1 text-sm text-red-600">
                    {errors.budget}
                  </p>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <Link
                href="/dashboard/projects"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
