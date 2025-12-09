import { useMemo } from "react";

interface HighlightedContentProps {
  content: string;
  terms: string[];
  maxLength?: number;
  className?: string;
}

export function HighlightedContent({
  content,
  terms,
  maxLength = 500,
  className = "",
}: HighlightedContentProps) {
  const highlightedContent = useMemo(() => {
    if (!content || !terms || terms.length === 0) {
      return content || "";
    }

    // Truncate content if needed
    let displayContent = content;
    if (maxLength && content.length > maxLength) {
      displayContent = content.substring(0, maxLength) + "...";
    }

    // Escape special regex characters in terms
    const escapedTerms = terms.map(term =>
      term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );

    // Create regex pattern for all terms (case insensitive)
    const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");

    // Split content by matches
    const parts = displayContent.split(pattern);

    return parts.map((part, index) => {
      const isMatch = terms.some(
        term => part.toLowerCase() === term.toLowerCase()
      );

      if (isMatch) {
        return (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800 text-foreground px-0.5 rounded font-medium"
          >
            {part}
          </mark>
        );
      }

      return part;
    });
  }, [content, terms, maxLength]);

  return (
    <span className={className}>
      {highlightedContent}
    </span>
  );
}
