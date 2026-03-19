export function stripMarkdown(text: string): string {
    let result = text;

    // Remove code fences (``` blocks) but keep content
    result = result.replace(/^```[\s\S]*?^```/gm, (match) => {
        const lines = match.split('\n');
        // Drop first and last lines (the fence markers)
        return lines.slice(1, -1).join('\n');
    });

    // Remove images ![alt](url) → alt
    result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

    // Remove links [text](url) → text
    result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

    // Remove headers # → keep text
    result = result.replace(/^#{1,6}\s+/gm, '');

    // Remove bold **text** or __text__
    result = result.replace(/(\*\*|__)(.*?)\1/g, '$2');

    // Remove italic *text* or _text_ (but not inside words like snake_case)
    result = result.replace(/(?<!\w)(\*|_)(.*?)\1(?!\w)/g, '$2');

    // Remove strikethrough ~~text~~
    result = result.replace(/~~(.*?)~~/g, '$1');

    // Remove inline code backticks
    result = result.replace(/`([^`]*)`/g, '$1');

    // Remove HTML tags
    result = result.replace(/<[^>]+>/g, '');

    // Remove horizontal rules
    result = result.replace(/^[-*_]{3,}\s*$/gm, '');

    // Remove blockquote markers
    result = result.replace(/^>\s?/gm, '');

    // Remove unordered list markers
    result = result.replace(/^[\s]*[-*+]\s+/gm, '');

    // Remove ordered list markers
    result = result.replace(/^[\s]*\d+\.\s+/gm, '');

    // Collapse multiple blank lines
    result = result.replace(/\n{3,}/g, '\n\n');

    // Trim
    result = result.trim();

    return result;
}
