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

    // Check if it's an Excel file
    const isExcel = url.toLowerCase().includes('.xls');
    if (isExcel) {
        return 'EXCEL_NO_PREVIEW'; // Special marker for Excel files
    }

    if (isOfficeFile(url)) {
        // Google Docs Viewer works better with Firebase Storage authenticated URLs
        return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

    // PDFs and images can be displayed directly
    return url;
};
