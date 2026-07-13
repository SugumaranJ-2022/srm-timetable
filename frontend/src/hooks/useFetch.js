import { useState, useCallback } from 'react';

export const useFetch = (apiFunc) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const request = useCallback(async (...args) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFunc(...args);
      setData(response);
      return response;
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'An unexpected error occurred';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunc]);

  return { data, loading, error, request, setData };
};

export default useFetch;
