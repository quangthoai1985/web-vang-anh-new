// Helper function to check for Office files
export const isOfficeFile = (url: string): boolean => {
    try {
        // Create URL object to parse the path
        const urlObj = new URL(url);
        const pathname = decodeURIComponent(urlObj.pathname).toLowerCase();

        const officeExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
        return officeExtensions.some(ext => pathname.endsWith(ext));
    } catch (e) {
        // Fallback for invalid URLs or relative paths
        const lowerUrl = url.toLowerCase().split('?')[0]; // Remove query params
        const officeExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
        return officeExtensions.some(ext => lowerUrl.endsWith(ext));
    }
};

// Helper to check if URL is a PDF
export const isPdfFile = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        const pathname = decodeURIComponent(urlObj.pathname).toLowerCase();
        return pathname.endsWith('.pdf');
    } catch (e) {
        const lowerUrl = url.toLowerCase().split('?')[0];
        return lowerUrl.endsWith('.pdf');
    }
};

export const getPreviewUrl = (url: string, isMobile: boolean = false): string => {
    if (!url || url === '#') return '#';

    // Check if it's an Excel file - these often fail in viewers
    const isExcel = url.toLowerCase().includes('.xls');
    if (isExcel) {
        return 'EXCEL_NO_PREVIEW'; // Special marker for Excel files
    }

    // Office files always use Google Docs Viewer (both mobile and desktop)
    if (isOfficeFile(url)) {
        return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

    // PDF files: 
    // - Mobile: Use Google Docs Viewer (direct PDF URLs often fail on real mobile browsers)
    // - Desktop: Display PDF directly in iframe (better performance)
    if (isPdfFile(url)) {
        if (isMobile) {
            return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        }
        // Desktop: return direct URL for native browser PDF rendering
        return url;
    }

    // Images can be displayed directly
    return url;
};

