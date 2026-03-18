import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ComplianceFlagSchema = z.object({
  id: z.string(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  recommendation: z.string(),
  affectedText: z.string().optional(),
  lineReference: z.string().optional(),
});

const ComplianceResultSchema = z.object({
  overallRisk: z.enum(["critical", "high", "medium", "low", "compliant"]),
  summary: z.string(),
  flags: z.array(ComplianceFlagSchema),
  checkedAt: z.string(),
  documentHash: z.string().optional(),
});

export type ComplianceFlag = z.infer<typeof ComplianceFlagSchema>;
export type ComplianceResult = z.infer<typeof ComplianceResultSchema>;

const COMPLIANCE_SYSTEM_PROMPT = `You are an expert compliance analyst specializing in regulatory requirements, legal standards, and industry best practices. Your role is to analyze documents for compliance issues across multiple domains including:

- Data privacy regulations (GDPR, CCPA, HIPAA, etc.)
- Financial regulations (SOX, PCI-DSS, AML, KYC, etc.)
- Employment law and HR compliance
- Contract law and legal obligations
- Industry-specific standards and certifications
- Security and cybersecurity requirements
- Environmental regulations
- Accessibility standards (WCAG, ADA, etc.)

When analyzing a document, you must:
1. Identify specific compliance issues, risks, and violations
2. Assess the severity of each issue
3. Provide actionable recommendations
4. Reference the specific text that raises concerns when applicable

You must respond with a valid JSON object matching this exact structure:
{
  "overallRisk": "critical" | "high" | "medium" | "low" | "compliant",
  "summary": "Brief overall assessment of the document's compliance status",
  "flags": [
    {
      "id": "unique-flag-id-string",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "Category name (e.g., 'Data Privacy', 'Financial Compliance')",
      "title": "Short title of the compliance issue",
      "description": "Detailed description of the compliance concern",
      "recommendation": "Specific actionable recommendation to address this issue",
      "affectedText": "The specific text from the document that triggered this flag (optional)",
      "lineReference": "Reference to location in document if identifiable (optional)"
    }
  ],
  "checkedAt": "ISO 8601 timestamp",
  "documentHash": "optional hash or identifier"
}

Be thorough but precise. Only flag genuine compliance concerns, not stylistic issues. If the document appears fully compliant, return an empty flags array with overallRisk set to "compliant".`;

function generateFlagId(index: number): string {
  return `flag-${Date.now()}-${index}`;
}

function ensureFlagIds(flags: ComplianceFlag[]): ComplianceFlag[] {
  return flags.map((flag, index) => ({
    ...flag,
    id: flag.id || generateFlagId(index),
  }));
}

function extractJsonFromResponse(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  throw new Error("No valid JSON found in Claude response");
}

export async function runComplianceCheck(
  documentText: string,
  options?: {
    documentName?: string;
    documentType?: string;
    jurisdiction?: string;
    additionalContext?: string;
  },
): Promise<ComplianceResult> {
  if (!documentText || documentText.trim().length === 0) {
    throw new Error("Document text cannot be empty");
  }

  const contextParts: string[] = [];

  if (options?.documentName) {
    contextParts.push(`Document Name: ${options.documentName}`);
  }
  if (options?.documentType) {
    contextParts.push(`Document Type: ${options.documentType}`);
  }
  if (options?.jurisdiction) {
    contextParts.push(`Jurisdiction: ${options.jurisdiction}`);
  }
  if (options?.additionalContext) {
    contextParts.push(`Additional Context: ${options.additionalContext}`);
  }

  const contextBlock =
    contextParts.length > 0
      ? `\n\nDocument Metadata:\n${contextParts.join("\n")}\n\n`
      : "\n\n";

  const userMessage = `Please perform a comprehensive compliance analysis on the following document.${contextBlock}Document Content:
---
${documentText}
---

Analyze this document for all compliance issues and return your findings as a JSON object matching the specified structure. Set the "checkedAt" field to "${new Date().toISOString()}".`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: COMPLIANCE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  const responseContent = message.content[0];
  if (responseContent.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }

  const responseText = responseContent.text;

  let parsedJson: unknown;
  try {
    const jsonString = extractJsonFromResponse(responseText);
    parsedJson = JSON.parse(jsonString);
  } catch (parseError) {
    throw new Error(
      `Failed to parse Claude response as JSON: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`,
    );
  }

  let validatedResult: ComplianceResult;
  try {
    validatedResult = ComplianceResultSchema.parse(parsedJson);
  } catch (validationError) {
    if (validationError instanceof z.ZodError) {
      throw new Error(
        `Claude response failed validation: ${validationError.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }
    throw validationError;
  }

  validatedResult.flags = ensureFlagIds(validatedResult.flags);

  return validatedResult;
}

export async function runBatchComplianceCheck(
  documents: Array<{
    text: string;
    name?: string;
    type?: string;
  }>,
): Promise<
  Array<{
    documentName: string;
    result: ComplianceResult | null;
    error: string | null;
  }>
> {
  const results = await Promise.allSettled(
    documents.map((doc) =>
      runComplianceCheck(doc.text, {
        documentName: doc.name,
        documentType: doc.type,
      }),
    ),
  );

  return results.map((result, index) => ({
    documentName: documents[index].name || `Document ${index + 1}`,
    result: result.status === "fulfilled" ? result.value : null,
    error:
      result.status === "rejected"
        ? result.reason instanceof Error
          ? result.reason.message
          : "Unknown error"
        : null,
  }));
}

export { ComplianceFlagSchema, ComplianceResultSchema };
