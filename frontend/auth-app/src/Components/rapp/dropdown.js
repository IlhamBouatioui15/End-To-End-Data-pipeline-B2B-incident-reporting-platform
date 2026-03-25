import React from 'react';

function Dropdown({ label, options, value, onChange }) {
  return (
    <div>
      <label className="block font-medium mb-1">{label}</label>
      <select
        className="border border-gray-300 p-2 rounded w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Choisir --</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

export default Dropdown;
