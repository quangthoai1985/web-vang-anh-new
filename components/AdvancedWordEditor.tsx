import React, { useRef, useEffect, useState } from 'react';
import { DocumentEditorContainerComponent, Toolbar, WordExport, SfdtExport, DocumentEditor } from '@syncfusion/ej2-react-documenteditor';
import { registerLicense } from '@syncfusion/ej2-base';
import { X, Save, Loader2 } from 'lucide-react';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Register Syncfusion modules
DocumentEditorContainerComponent.Inject(Toolbar, WordExport, SfdtExport);

// Import Syncfusion styles
import '@syncfusion/ej2-base/styles/material.css';
import '@syncfusion/ej2-buttons/styles/material.css';
import '@syncfusion/ej2-inputs/styles/material.css';
import '@syncfusion/ej2-popups/styles/material.css';
import '@syncfusion/ej2-lists/styles/material.css';
import '@syncfusion/ej2-navigations/styles/material.css';
import '@syncfusion/ej2-splitbuttons/styles/material.css';
import '@syncfusion/ej2-dropdowns/styles/material.css';
import '@syncfusion/ej2-react-documenteditor/styles/material.css';

interface AdvancedWordEditorProps {
    fileUrl: string;
    planId: string;
    planTitle: string;
    onClose: () => void;
    onSaveSuccess: (newUrl: string) => void;
    collectionName: string;
    storageFolder?: string;
}

const AdvancedWordEditor: React.FC<AdvancedWordEditorProps> = ({ fileUrl, planId, planTitle, onClose, onSaveSuccess, collectionName, storageFolder = 'plans' }) => {
    const editorContainerRef = useRef<DocumentEditorContainerComponent>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // License key is registered globally in index.tsx


    // Load file logic
    const loadFile = async () => {
        if (!fileUrl || !editorContainerRef.current) return;

        try {
            setIsLoading(true);

            // 1. Fetch file as Blob from Firebase Storage
            // Use Access-Control-Expose-Headers if CORS issue persists, or standard fetch
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const file = new File([blob], "document.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

            // 2. Use the system service URL to open the document
            // Ideally we should use the DocumentEditor's 'open' method which sends the file to the serviceUrl
            // However, typical React component usage usually involves passing the file directly if the 'serviceUrl' is set properly on the container.

            // We need to use XMLHttpRequest to send the file to the import service
            const serviceUrl = editorContainerRef.current.serviceUrl + 'Import';

            const httpRequest = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('files', file);

            httpRequest.open('POST', serviceUrl, true);
            httpRequest.onreadystatechange = function () {
                if (httpRequest.readyState === 4) {
                    if (httpRequest.status === 200) {
                        if (editorContainerRef.current) {
                            editorContainerRef.current.documentEditor.open(httpRequest.responseText);
                        }
                    } else {
                        console.error('Failed to load document via service');
                        // Fallback or error handling
                    }
                    setIsLoading(false);
                }
            };
            httpRequest.send(formData);

        } catch (error) {
            console.error("Error loading file:", error);
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editorContainerRef.current) return;

        setIsSaving(true);
        try {
            // 1. Save document as Blob (Docx format)
            const blob = await editorContainerRef.current.documentEditor.saveAsBlob('Docx');

            // 2. Upload to Firebase Storage
            // Create a unique filename to avoid caching issues on clients, or overwrite?
            // User requested to preserve permissions, usually overwriting is better for "Editing" flow
            // But we might want to keep history? Stick to overwriting for now as per previous logic.
            // Extract file extension and path safe name
            const timestamp = Date.now();
            const safeName = planTitle.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${storageFolder}/${timestamp}_${safeName}.docx`;
            const storageRef = ref(storage, fileName);

            await uploadBytes(storageRef, blob, {
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            // 3. Get new URL
            const newDownloadUrl = await getDownloadURL(storageRef);

            // 4. Update Firestore
            const planDocRef = doc(db, collectionName, planId);
            await updateDoc(planDocRef, {
                url: newDownloadUrl,
                lastModified: new Date().toISOString()
            });

            console.log("Saved successfully:", newDownloadUrl);
            onSaveSuccess(newDownloadUrl); // Assuming onSaveSuccess handles refresh

            setIsSaving(false);
            onClose();
        } catch (error: any) {
            console.error("Error saving:", error);
            setIsSaving(false);
            alert("Lỗi khi lưu file: " + error.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white shadow-md">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Loader2 className={`h-6 w-6 ${isLoading ? 'animate-spin' : 'hidden'}`} />
                        {!isLoading && <div className="h-6 w-6 font-bold flex items-center justify-center">W</div>}
                    </div>
                    <div>
                        <h2 className="font-semibold text-lg">{planTitle}</h2>
                        <p className="text-xs text-blue-100 opacity-80">Syncfusion Editor Mode</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="px-4 py-2 bg-white text-blue-700 rounded hover:bg-blue-50 font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSaving ? 'Đang lưu...' : 'Lưu lại'}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-blue-500 rounded-full transition-colors"
                        title="Đóng editor"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Editor Container */}
            <div className="flex-1 overflow-hidden bg-gray-100 relative">
                <DocumentEditorContainerComponent
                    ref={editorContainerRef}
                    id="container"
                    height={'100%'}
                    enableToolbar={true}
                    // Use Syncfusion's public demo service for testing. 
                    // WARNING: Do not upload sensitive data permanently. We are only processing.
                    serviceUrl="https://ej2services.syncfusion.com/production/web-services/api/documenteditor/"
                    locale="vi-VN"
                    created={loadFile} // Load file when component is created
                />
            </div>
        </div>
    );
};

export default AdvancedWordEditor;
