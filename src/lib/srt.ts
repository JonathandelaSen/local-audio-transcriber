export function formatTime(seconds: number): string {
    const pad = (num: number, size: number) => ('000' + num).slice(-size);
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const secs = date.getUTCSeconds();
    const ms = date.getUTCMilliseconds();
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}

export function generateSrt(chunks: any[]): string {
    if (!chunks || chunks.length === 0) return "";
    return chunks.map((chunk, index) => {
        const start = formatTime(chunk.timestamp[0]);
        // Provide a fallback for the end time if it's missing (e.g. streaming last chunk)
        const end = formatTime(chunk.timestamp[1] !== null ? chunk.timestamp[1] : chunk.timestamp[0] + 5);
        return `${index + 1}\n${start} --> ${end}\n${chunk.text.trim()}\n`;
    }).join('\n');
}
