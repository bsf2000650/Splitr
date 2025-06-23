import { useMutation, useQuery } from "convex/react"
import { err } from "inngest/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const useConvexQuery = (query, ...args) => {
  const result = useQuery(query, ...args);

  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{
    if(result === undefined){
      setIsLoading(true);
    }else{
      try {
        setData(result);
        setError(null);
      } catch (error) {
        setError(err);
      } finally{
        setIsLoading(false);
      }
    }
  },[result]);

  return{
    data,
    isLoading,
    error
  }
}

export const useConvexMutation = (mutation) => {
  const mutationFn = useMutation(mutation);

  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const mutate = async(...args) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await mutationFn(...args);
      setData(response);
    } catch (error) {
      setError(err);
      toast.error(err.message);
    }finally{
      setIsLoading(false);
    }
  }

  return {mutate, data, isLoading, error};
}