import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, getDocs, setDoc, doc, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface SchoolYearContextType {
    currentSchoolYear: string;
    setCurrentSchoolYear: (year: string) => void;
    schoolYears: string[];
    isLoading: boolean;
    createNewSchoolYear: (year: string) => Promise<void>;
}

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

export const SchoolYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentSchoolYear, setCurrentSchoolYear] = useState<string>('2025-2026');
    const [schoolYears, setSchoolYears] = useState<string[]>(['2025-2026']);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'school_years')); // Order by something if needed
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const years = snapshot.docs.map(doc => doc.id).sort().reverse(); // Sort descending

            if (years.length === 0) {
                // Initialize default if empty
                initializeDefaultYear();
            } else {
                setSchoolYears(years);
                // If current selection is not in list, default to latest
                if (!years.includes(currentSchoolYear)) {
                    setCurrentSchoolYear(years[0]);
                }
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const initializeDefaultYear = async () => {
        try {
            await setDoc(doc(db, 'school_years', '2025-2026'), {
                createdAt: serverTimestamp(),
                name: 'Năm học 2025-2026'
            });
            setSchoolYears(['2025-2026']);
            setCurrentSchoolYear('2025-2026');
        } catch (error) {
            console.error("Error initializing default school year:", error);
        }
    };

    const createNewSchoolYear = async (year: string) => {
        try {
            await setDoc(doc(db, 'school_years', year), {
                createdAt: serverTimestamp(),
                name: `Năm học ${year}`
            });
            // The snapshot listener will update the list
            setCurrentSchoolYear(year); // Auto switch needs to wait or be optimistic
        } catch (error) {
            console.error("Error creating school year:", error);
            throw error;
        }
    };

    return (
        <SchoolYearContext.Provider value={{
            currentSchoolYear,
            setCurrentSchoolYear,
            schoolYears,
            isLoading,
            createNewSchoolYear
        }}>
            {children}
        </SchoolYearContext.Provider>
    );
};

export const useSchoolYear = () => {
    const context = useContext(SchoolYearContext);
    if (context === undefined) {
        throw new Error('useSchoolYear must be used within a SchoolYearProvider');
    }
    return context;
};
