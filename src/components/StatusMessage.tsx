import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface StatusMessageProps {
  type: 'success' | 'error' | 'loading';
  message: string;
}

export default function StatusMessage({ type, message }: StatusMessageProps) {
  const styles = {
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: <XCircle className="w-5 h-5 text-red-600" />
    },
    loading: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      icon: <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
    }
  };

  const style = styles[type];

  return (
    <div className={`${style.bg} border rounded-lg p-4 flex items-center gap-3 w-full max-w-3xl`}>
      {style.icon}
      <p className={`${style.text} font-medium`}>{message}</p>
    </div>
  );
}
