import { useNavigate } from 'react-router-dom';

export default function ConfirmEmail() {
  const navigate = useNavigate();

  const handleAcknowledge = () => {
    navigate('/login'); // Redirect to login page after acknowledgment
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Confirm Your Email</h2>
        <p className="text-gray-600 mb-6">
          A confirmation email has been sent to your email address. Please check your inbox and click the confirmation link to verify your email.
        </p>
        <button
          onClick={handleAcknowledge}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
        >
          I Acknowledge
        </button>
      </div>
    </div>
  );
}
