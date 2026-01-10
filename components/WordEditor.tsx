import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    Save,
    Loader2,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Undo,
    Redo,
    TableIcon,
    Plus,
    Minus,
    Trash2,
    Type,
    Highlighter,
    Link,
    Unlink,
    FileText
} from 'lucide-react';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

interface WordEditorProps {
    fileUrl: string;
    planId: string;
    planTitle: string;
    onClose: () => void;
    onSaveSuccess: () => void;
}

const WordEditor: React.FC<WordEditorProps> = ({ fileUrl, planId, planTitle, onClose, onSaveSuccess }) => {
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    // Extract storage path from Firebase URL
    const getStorageRefFromUrl = (url: string) => {
        try {
            // Firebase Storage URLs have format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?token=...
            const decodedUrl = decodeURIComponent(url);
            const match = decodedUrl.match(/\/o\/(.+?)\?/);
            if (match && match[1]) {
                return ref(storage, match[1]);
            }
            // Fallback: try direct URL for gs:// style
            return ref(storage, url);
        } catch {
            return null;
        }
    };

    // Load Word file and convert to HTML
    useEffect(() => {
        const loadWordFile = async () => {
            try {
                setIsLoading(true);
                setError(null);

                let arrayBuffer: ArrayBuffer;

                // Try to get storage ref from URL and use getBlob
                const storageRef = getStorageRefFromUrl(fileUrl);

                if (storageRef) {
                    try {
                        // Use Firebase SDK getBlob to avoid CORS issues
                        const blob = await getBlob(storageRef);
                        arrayBuffer = await blob.arrayBuffer();
                    } catch (blobError) {
                        console.log('getBlob failed, trying fetch...', blobError);
                        // Fallback to fetch if getBlob fails
                        const response = await fetch(fileUrl, { mode: 'cors' });
                        if (!response.ok) {
                            throw new Error('Không thể tải file');
                        }
                        arrayBuffer = await response.arrayBuffer();
                    }
                } else {
                    // No storage ref, try direct fetch
                    const response = await fetch(fileUrl);
                    if (!response.ok) {
                        throw new Error('Không thể tải file');
                    }
                    arrayBuffer = await response.arrayBuffer();
                }

                // Convert Word to HTML using mammoth with table support
                const result = await mammoth.convertToHtml(
                    { arrayBuffer },
                    {
                        styleMap: [
                            "p[style-name='Heading 1'] => h1:fresh",
                            "p[style-name='Heading 2'] => h2:fresh",
                            "p[style-name='Heading 3'] => h3:fresh",
                            "b => strong",
                            "i => em",
                            "u => u",
                            "strike => s"
                        ],
                        // Convert table elements
                        convertImage: mammoth.images.imgElement((image) => {
                            return image.read("base64").then((imageBuffer) => {
                                return {
                                    src: "data:" + image.contentType + ";base64," + imageBuffer
                                };
                            });
                        })
                    }
                );

                // Post-process HTML to add table styling
                let processedHtml = result.value;

                // Add table styling with centered text for first row (header row)
                processedHtml = processedHtml.replace(/<table>/g,
                    '<table style="border-collapse: collapse; width: 100%; margin: 15px 0; border: 1px solid #333;">');
                processedHtml = processedHtml.replace(/<tr>/g,
                    '<tr style="border: 1px solid #333;">');
                processedHtml = processedHtml.replace(/<td>/g,
                    '<td style="border: 1px solid #333; padding: 8px; vertical-align: middle;">');
                processedHtml = processedHtml.replace(/<th>/g,
                    '<th style="border: 1px solid #333; padding: 8px; background-color: #f5f5f5; font-weight: bold; text-align: center;">');

                // Auto-center title-like paragraphs (common Vietnamese document patterns)
                const titlePatterns = [
                    'KẾ HOẠCH', 'CHỦ ĐỀ', 'BIÊN BẢN', 'BÁO CÁO', 'THÔNG BÁO',
                    'NỘI DUNG', 'DANH SÁCH', 'NHẬN XÉT', 'PHỤ LỤC'
                ];
                titlePatterns.forEach(pattern => {
                    const regex = new RegExp(`<p>\\s*(${pattern}[^<]*)`, 'gi');
                    processedHtml = processedHtml.replace(regex,
                        '<p style="text-align: center; font-weight: bold;">$1');
                });

                // Center-align paragraphs that are short (likely headers/titles) and start with all caps
                processedHtml = processedHtml.replace(/<p>([A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ\s\d:]+)<\/p>/g,
                    (match, content) => {
                        if (content.length < 100) { // Short all-caps = likely title
                            return `<p style="text-align: center; font-weight: bold;">${content}</p>`;
                        }
                        return match;
                    });

                // Add center alignment for first column cells (row headers)
                // This targets the specific table structure in the kế hoạch documents
                processedHtml = processedHtml.replace(/(<tr[^>]*>)\s*<td style="[^"]*">([^<]{1,30})<\/td>/g,
                    (match, trTag, content) => {
                        return `${trTag}<td style="border: 1px solid #333; padding: 8px; vertical-align: middle; text-align: center; font-weight: bold;">${content}</td>`;
                    });

                setHtmlContent(processedHtml);

                // Set content to editor after a small delay
                setTimeout(() => {
                    if (editorRef.current) {
                        editorRef.current.innerHTML = processedHtml;
                    }
                }, 100);

            } catch (err) {
                console.error('Error loading Word file:', err);
                setError('Không thể tải file Word. Vui lòng thử lại.');
            } finally {
                setIsLoading(false);
            }
        };

        loadWordFile();
    }, [fileUrl]);


    // Execute formatting command
    const execCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    // Format buttons configuration
    const formatButtons = [
        { icon: Bold, command: 'bold', title: 'In đậm (Ctrl+B)' },
        { icon: Italic, command: 'italic', title: 'In nghiêng (Ctrl+I)' },
        { icon: Underline, command: 'underline', title: 'Gạch chân (Ctrl+U)' },
        { icon: Strikethrough, command: 'strikeThrough', title: 'Gạch ngang' },
    ];

    const alignButtons = [
        { icon: AlignLeft, command: 'justifyLeft', title: 'Căn trái' },
        { icon: AlignCenter, command: 'justifyCenter', title: 'Căn giữa' },
        { icon: AlignRight, command: 'justifyRight', title: 'Căn phải' },
        { icon: AlignJustify, command: 'justifyFull', title: 'Căn đều' },
    ];

    const listButtons = [
        { icon: List, command: 'insertUnorderedList', title: 'Danh sách dấu chấm' },
        { icon: ListOrdered, command: 'insertOrderedList', title: 'Danh sách đánh số' },
    ];

    // Heading functions
    const insertHeading = (level: number) => {
        execCommand('formatBlock', `h${level}`);
    };

    // Insert table function
    const insertTable = (rows: number = 3, cols: number = 3) => {
        let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
        for (let i = 0; i < rows; i++) {
            tableHtml += '<tr>';
            for (let j = 0; j < cols; j++) {
                tableHtml += '<td style="border: 1px solid #ccc; padding: 8px; min-width: 50px;">&nbsp;</td>';
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</table>';
        execCommand('insertHTML', tableHtml);
    };

    // Insert link
    const insertLink = () => {
        const url = prompt('Nhập URL liên kết:');
        if (url) {
            execCommand('createLink', url);
        }
    };

    // Remove link
    const removeLink = () => {
        execCommand('unlink');
    };

    // Text color
    const changeTextColor = (color: string) => {
        execCommand('foreColor', color);
    };

    // Highlight color
    const changeHighlightColor = (color: string) => {
        execCommand('hiliteColor', color);
    };

    // Convert HTML to DOCX and save
    const handleSave = async () => {
        if (!editorRef.current) return;

        try {
            setIsSaving(true);

            const currentHtml = editorRef.current.innerHTML;

            // Parse HTML and create DOCX content
            const docChildren: (Paragraph | Table)[] = [];
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = currentHtml;

            // Process each child element
            const processNode = (node: Node): void => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent?.trim();
                    if (text) {
                        docChildren.push(new Paragraph({
                            children: [new TextRun({ text })]
                        }));
                    }
                    return;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) return;

                const element = node as HTMLElement;
                const tagName = element.tagName.toLowerCase();

                // Handle headings
                if (tagName.match(/^h[1-6]$/)) {
                    const level = parseInt(tagName[1]);
                    const headingMap: { [key: number]: typeof HeadingLevel[keyof typeof HeadingLevel] } = {
                        1: HeadingLevel.HEADING_1,
                        2: HeadingLevel.HEADING_2,
                        3: HeadingLevel.HEADING_3,
                        4: HeadingLevel.HEADING_4,
                        5: HeadingLevel.HEADING_5,
                        6: HeadingLevel.HEADING_6,
                    };
                    docChildren.push(new Paragraph({
                        heading: headingMap[level],
                        children: [new TextRun({ text: element.textContent || '' })]
                    }));
                    return;
                }

                // Handle paragraphs
                if (tagName === 'p') {
                    const textRuns: TextRun[] = [];
                    processInlineElements(element, textRuns);

                    // Get alignment
                    let alignment = AlignmentType.LEFT;
                    const style = element.style;
                    if (style.textAlign === 'center') alignment = AlignmentType.CENTER;
                    else if (style.textAlign === 'right') alignment = AlignmentType.RIGHT;
                    else if (style.textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;

                    docChildren.push(new Paragraph({
                        children: textRuns,
                        alignment
                    }));
                    return;
                }

                // Handle tables
                if (tagName === 'table') {
                    const tableRows: TableRow[] = [];
                    const rows = element.querySelectorAll('tr');

                    rows.forEach(row => {
                        const cells: TableCell[] = [];
                        const cellElements = row.querySelectorAll('td, th');

                        cellElements.forEach(cell => {
                            cells.push(new TableCell({
                                children: [new Paragraph({
                                    children: [new TextRun({ text: cell.textContent || '' })]
                                })],
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 1 },
                                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                                    left: { style: BorderStyle.SINGLE, size: 1 },
                                    right: { style: BorderStyle.SINGLE, size: 1 },
                                }
                            }));
                        });

                        if (cells.length > 0) {
                            tableRows.push(new TableRow({ children: cells }));
                        }
                    });

                    if (tableRows.length > 0) {
                        docChildren.push(new Table({
                            rows: tableRows,
                            width: { size: 100, type: WidthType.PERCENTAGE }
                        }));
                    }
                    return;
                }

                // Handle lists
                if (tagName === 'ul' || tagName === 'ol') {
                    const items = element.querySelectorAll('li');
                    items.forEach((item, index) => {
                        const bullet = tagName === 'ul' ? '• ' : `${index + 1}. `;
                        docChildren.push(new Paragraph({
                            children: [new TextRun({ text: bullet + (item.textContent || '') })]
                        }));
                    });
                    return;
                }

                // Handle div and other block elements - process children
                if (tagName === 'div' || tagName === 'section' || tagName === 'article') {
                    element.childNodes.forEach(child => processNode(child));
                    return;
                }

                // Fallback: treat as paragraph
                if (element.textContent?.trim()) {
                    const textRuns: TextRun[] = [];
                    processInlineElements(element, textRuns);
                    if (textRuns.length > 0) {
                        docChildren.push(new Paragraph({ children: textRuns }));
                    }
                }
            };

            // Process inline elements (bold, italic, etc.)
            const processInlineElements = (element: HTMLElement, textRuns: TextRun[]) => {
                element.childNodes.forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        const text = child.textContent;
                        if (text) {
                            textRuns.push(new TextRun({ text }));
                        }
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        const el = child as HTMLElement;
                        const tag = el.tagName.toLowerCase();
                        const text = el.textContent || '';

                        const runOptions: {
                            text: string;
                            bold?: boolean;
                            italics?: boolean;
                            underline?: { type: 'single' };
                            strike?: boolean;
                        } = { text };

                        if (tag === 'strong' || tag === 'b') runOptions.bold = true;
                        if (tag === 'em' || tag === 'i') runOptions.italics = true;
                        if (tag === 'u') runOptions.underline = { type: 'single' };
                        if (tag === 's' || tag === 'strike') runOptions.strike = true;

                        // Handle nested formatting
                        if (el.querySelector('strong, b')) runOptions.bold = true;
                        if (el.querySelector('em, i')) runOptions.italics = true;
                        if (el.querySelector('u')) runOptions.underline = { type: 'single' };

                        textRuns.push(new TextRun(runOptions));
                    }
                });
            };

            // Process all children of the temp div
            tempDiv.childNodes.forEach(child => processNode(child));

            // If no content was processed, add empty paragraph
            if (docChildren.length === 0) {
                docChildren.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
            }

            // Create the document
            const docxDocument = new Document({
                sections: [{
                    properties: {},
                    children: docChildren
                }]
            });

            // Generate the DOCX blob
            const blob = await Packer.toBlob(docxDocument);

            // Upload to Firebase Storage (overwrite existing file)
            const fileName = `plans/${Date.now()}_${planTitle.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, blob);
            const newDownloadUrl = await getDownloadURL(storageRef);

            // Update Firestore document with new URL
            const planDocRef = doc(db, 'plans', planId);
            await updateDoc(planDocRef, {
                url: newDownloadUrl,
                lastModified: new Date().toISOString()
            });

            onSaveSuccess();
            onClose();

        } catch (err) {
            console.error('Error saving Word file:', err);
            setError('Không thể lưu file. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    // Color palette
    const textColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#808080'];
    const highlightColors = ['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FF0000', '#0000FF'];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Chỉnh sửa tài liệu</h2>
                            <p className="text-xs text-orange-100 truncate max-w-md">{planTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-white" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-1 flex-shrink-0">

                    {/* Undo/Redo */}
                    <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
                        <button
                            onClick={() => execCommand('undo')}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Hoàn tác (Ctrl+Z)"
                        >
                            <Undo className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                            onClick={() => execCommand('redo')}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Làm lại (Ctrl+Y)"
                        >
                            <Redo className="h-4 w-4 text-gray-600" />
                        </button>
                    </div>

                    {/* Headings */}
                    <div className="flex items-center gap-1 px-2 border-r border-gray-300">
                        <button
                            onClick={() => insertHeading(1)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Heading 1"
                        >
                            <Heading1 className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                            onClick={() => insertHeading(2)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Heading 2"
                        >
                            <Heading2 className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                            onClick={() => insertHeading(3)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Heading 3"
                        >
                            <Heading3 className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                            onClick={() => execCommand('formatBlock', 'p')}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Đoạn văn"
                        >
                            <Type className="h-4 w-4 text-gray-600" />
                        </button>
                    </div>

                    {/* Format buttons */}
                    <div className="flex items-center gap-1 px-2 border-r border-gray-300">
                        {formatButtons.map(({ icon: Icon, command, title }) => (
                            <button
                                key={command}
                                onClick={() => execCommand(command)}
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                title={title}
                            >
                                <Icon className="h-4 w-4 text-gray-600" />
                            </button>
                        ))}
                    </div>

                    {/* Text Color */}
                    <div className="flex items-center gap-1 px-2 border-r border-gray-300 relative group">
                        <div className="relative">
                            <button
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                                title="Màu chữ"
                            >
                                <Type className="h-4 w-4 text-gray-600" />
                                <div className="w-4 h-1 bg-red-500 rounded-full"></div>
                            </button>
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 hidden group-hover:grid grid-cols-4 gap-1 z-10">
                                {textColors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => changeTextColor(color)}
                                        className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Highlight Color */}
                    <div className="flex items-center gap-1 px-2 border-r border-gray-300 relative group">
                        <div className="relative">
                            <button
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Tô màu nền"
                            >
                                <Highlighter className="h-4 w-4 text-gray-600" />
                            </button>
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 hidden group-hover:grid grid-cols-3 gap-1 z-10">
                                {highlightColors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => changeHighlightColor(color)}
                                        className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Alignment */}
                    <div className="flex items-center gap-1 px-2 border-r border-gray-300">
                        {alignButtons.map(({ icon: Icon, command, title }) => (
                            <button
                                key={command}
                                onClick={() => execCommand(command)}
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                title={title}
                            >
                                <Icon className="h-4 w-4 text-gray-600" />
                            </button>
                        ))}
                    </div>

                    {/* Lists */}
                    <div className="flex items-center gap-1 px-2 border-r border-gray-300">
                        {listButtons.map(({ icon: Icon, command, title }) => (
                            <button
                                key={command}
                                onClick={() => execCommand(command)}
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                title={title}
                            >
                                <Icon className="h-4 w-4 text-gray-600" />
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="flex items-center gap-1 px-2 border-r border-gray-300">
                        <button
                            onClick={() => insertTable(3, 3)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Chèn bảng 3x3"
                        >
                            <TableIcon className="h-4 w-4 text-gray-600" />
                        </button>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-1 px-2">
                        <button
                            onClick={insertLink}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Chèn liên kết"
                        >
                            <Link className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                            onClick={removeLink}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Xóa liên kết"
                        >
                            <Unlink className="h-4 w-4 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 overflow-hidden bg-gray-100 p-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="h-12 w-12 text-orange-500 animate-spin mb-4" />
                            <p className="text-gray-600 font-medium">Đang tải tài liệu...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="p-4 bg-red-100 rounded-full mb-4">
                                <X className="h-12 w-12 text-red-500" />
                            </div>
                            <p className="text-red-600 font-medium">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-lg h-full overflow-auto">
                            <div
                                ref={editorRef}
                                contentEditable
                                className="min-h-full p-8 outline-none prose prose-sm max-w-none focus:ring-2 focus:ring-orange-200"
                                style={{
                                    fontFamily: "'Times New Roman', Times, serif",
                                    fontSize: '14px',
                                    lineHeight: '1.8'
                                }}
                                onInput={() => {
                                    // Content updates are handled via ref
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <p className="text-xs text-gray-500">
                        💡 Tip: Sử dụng Ctrl+B để in đậm, Ctrl+I để in nghiêng
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="px-6 py-2 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Lưu thay đổi
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WordEditor;
