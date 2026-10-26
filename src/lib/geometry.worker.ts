import { calculateLayout } from './geometry';
import type { Project } from '../types';
self.onmessage = (event: MessageEvent<{project:Project; id:number}>) => {
  try { self.postMessage({id:event.data.id,result:calculateLayout(event.data.project)}); }
  catch (error) { self.postMessage({id:event.data.id,error:error instanceof Error ? error.message : 'Der Plan konnte nicht berechnet werden.'}); }
};
