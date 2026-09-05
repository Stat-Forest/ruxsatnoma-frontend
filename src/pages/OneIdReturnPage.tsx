import { Navigate } from 'react-router';
import { takeNext } from './oneIdReturnCache';

export function OneIdReturnPage() {
  return <Navigate to={takeNext()} replace />;
}
