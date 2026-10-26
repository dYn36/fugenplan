import { useEffect, useState } from 'react';
import type { WorkspaceRoom } from '../floorplan-types';
import type { LayoutResult, Project } from '../types';

export type RoomPlan = { project: Project; result?: LayoutResult; error?: string };

/** Calculate the overview sequentially so a project never starts one worker per room. */
export function useRoomPlans(rooms: WorkspaceRoom[]) {
  const [plans, setPlans] = useState<Record<string, RoomPlan>>({});
  useEffect(() => {
    const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
    let index = 0;
    setPlans({});
    const next = () => {
      const room = rooms[index];
      if (room) worker.postMessage({ project: room.project, id: index });
    };
    worker.onmessage = (event: MessageEvent<{ id: number; result?: LayoutResult; error?: string }>) => {
      if (event.data.id !== index) return;
      const room = rooms[index];
      setPlans(current => ({ ...current, [room.id]: { project: room.project, result: event.data.result, error: event.data.error } }));
      index += 1;
      next();
    };
    worker.onerror = () => {
      setPlans(current => ({ ...current, ...Object.fromEntries(rooms.slice(index).map(room => [room.id, {
        project: room.project, error: 'Der Plan konnte nicht berechnet werden. Öffne den Raum und prüfe die Eingaben.',
      }])) }));
    };
    next();
    return () => worker.terminate();
  }, [rooms]);
  return plans;
}
