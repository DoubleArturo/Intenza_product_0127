import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { generateDataInsight } from '../services/geminiService';

interface Props {
  context: string;
  data: any;
}

const GeminiInsight: React.FC<Props> = ({ context, data }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const result = await generateDataInsight(context, data);
    setInsight(result);
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-intenza-600">
          <Sparkles size={18} />
          <h3 className="font-semibold text-sm uppercase tracking-wider">AI Quality Insight</h3>
        </div>
        {!loading && (
          <button 
            onClick={handleGenerate} 
            className="text-xs font-medium text-slate-500 hover:text-intenza-600 flex items-center gap-1 transition-colors"
          >
            {insight ? <><RefreshCw size={12}/> Refresh</> : 'Analyze'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Analyzing design data...</span>
        </div>
      ) : insight ? (
        <div className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none">
          {insight.split('\n').map((line, i) => (
            <p key={i} className="mb-1">{line}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Click analyze to get an executive summary of this data using Gemini AI.
        </p>
      )}
    </div>
  );
};

export default GeminiInsight;