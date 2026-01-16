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

export const getPreviewUrl = (url: string): string => {
    if (!url || url === '#') return '#';

    // Check if it's an Excel file - these often fail in viewers
    const isExcel = url.toLowerCase().includes('.xls');
    if (isExcel) {
        return 'EXCEL_NO_PREVIEW'; // Special marker for Excel files
    }

    if (isOfficeFile(url)) {
        // Use Google Docs Viewer - it works with Firebase Storage authenticated URLs
        // Note: On mobile, user may need to tap "Open" button to view the document
        return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

    // PDFs and images can be displayed directly
    return url;
};

