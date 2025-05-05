import React from 'react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Welcome to Orpheus
        </h1>
        <p className="text-xl text-gray-600">
          Create and manage your layered audio presets
        </p>
      </div>
    </div>
  );
};

export default LandingPage; 