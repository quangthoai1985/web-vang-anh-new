import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import DirectiveDocuments from './pages/DirectiveDocuments';
import SchoolDocuments from './pages/SchoolDocuments';
import SystemAdmin from './pages/SystemAdmin';
import OfficeDocuments from './pages/OfficeDocuments';
import BoardingMenu from './pages/BoardingMenu';
import ProfessionalGroupPlans from './pages/ProfessionalGroupPlans';
import ClassRecords from './pages/ClassRecords';
import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SchoolYearProvider } from './context/SchoolYearContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <SchoolYearProvider>
          <Router>
            <div className="flex flex-col min-h-screen font-sans text-gray-900 bg-gray-50">
              <Header />
              <main className="flex-grow">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/van-ban-chi-dao" element={<DirectiveDocuments />} />
                  <Route path="/van-ban-truong" element={<SchoolDocuments />} />
                  <Route path="/quan-tri-he-thong" element={<SystemAdmin />} />
                  <Route path="/to-van-phong-ke-hoach" element={<OfficeDocuments />} />
                  <Route path="/to-van-phong-thuc-don" element={<BoardingMenu />} />
                  <Route path="/to-chuyen-mon-ke-hoach" element={<ProfessionalGroupPlans />} />
                  <Route path="/class/:classId" element={<ClassRecords />} />
                </Routes>
              </main>
            </div>
          </Router>
        </SchoolYearProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;