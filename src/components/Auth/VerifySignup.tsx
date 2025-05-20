import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function VerifySignup() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyUser = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      const email = searchParams.get('email');

      if (!token || type !== 'signup' || !email) {
        setStatus('error');
        setErrorMessage('Invalid verification link.');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });

      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
      } else {
        setStatus('success');
      }
    };

    verifyUser();
  }, [searchParams]);

  const handleProceed = () => {
    navigate('/login'); // Redirect to login page after verification
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
        {status === 'verifying' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Verifying...</h2>
            <p className="text-gray-600">Please wait while we verify your account.</p>
          </div>
        )}
        {status === 'success' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Verification Successful</h2>
            <p className="text-gray-600 mb-6">Your account has been successfully verified. You can now log in.</p>
            <button
              onClick={handleProceed}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
            >
              Proceed to Login
            </button>
          </div>
        )}
        {status === 'error' && (
          <div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={handleProceed}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
