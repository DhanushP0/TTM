import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SelectBuildingFloorPage() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchBuildings() {
      const { data } = await supabase.from('buildings').select('*');
      if (data) setBuildings(data);
    }
    fetchBuildings();
  }, []);

  useEffect(() => {
    async function fetchFloors() {
      if (!selectedBuilding) return;
      const { data } = await supabase
        .from('floors')
        .select('*')
        .eq('building_id', selectedBuilding);
      if (data) setFloors(data);
    }
    fetchFloors();
  }, [selectedBuilding]);

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col gap-6 justify-center items-center">
      <div className="w-full max-w-md space-y-4">
        <select
          className="w-full p-3 border rounded"
          onChange={(e) => setSelectedBuilding(Number(e.target.value))}
          value={selectedBuilding ?? ''}
        >
          <option value="" disabled>Select Building</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          className="w-full p-3 border rounded"
          onChange={(e) => setSelectedFloor(Number(e.target.value))}
          value={selectedFloor ?? ''}
          disabled={!selectedBuilding}
        >
          <option value="" disabled>Select Floor</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>Floor {f.floor_number}</option>
          ))}
        </select>

        <button
          className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50"
          disabled={!selectedBuilding || !selectedFloor}
          onClick={() => {
            navigate(`/classroom-display?building=${selectedBuilding}&floor=${selectedFloor}`);
          }}
        >
          View Classrooms
        </button>
      </div>
    </div>
  );
}
