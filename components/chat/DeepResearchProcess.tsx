"use client";

import React from 'react';

interface DeepResearchProcessProps {
  steps: Array<{
    name: string;
    status: 'completed' | 'in-progress' | 'pending';
  }>;
}

export function DeepResearchProcess({ steps }: DeepResearchProcessProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-800">
      <h3 className="text-sm font-semibold mb-3 dark:text-gray-200">Deep Research Process</h3>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-xs
              ${step.status === 'completed' ? 'bg-green-500' : 
                step.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              {step.status === 'completed' ? '✓' : '•'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium dark:text-gray-300">{step.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 