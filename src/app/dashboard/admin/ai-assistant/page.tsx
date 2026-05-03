'use client';
import { useState } from 'react';
import { Card, Button, Textarea } from '@/components/ui';
import { Brain, Send, Sparkles, CheckCircle, Info } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

const EXAMPLE_COMMANDS = [
  'Mark all teachers present for today',
  'Mark all teachers absent for last Monday',
  'Mark attendance present for all teachers this week',
  'Set all teachers absent for December 25th',
];

interface AIResult {
  interpretation: {
    action: string;
    params: Record<string, unknown>;
    explanation: string;
  };
  executed: boolean;
  message: string;
  upserted?: number;
}

export default function AdminAIAssistantPage() {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  const handleSubmit = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiCall<AIResult>('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
      setResult(data);
      if (data.executed) toast.success('Command executed successfully!');
      else toast(data.message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-3xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-brand-600/20 border border-brand-500/30">
            <Brain size={20} className="text-brand-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">AI Attendance Assistant</h1>
        </div>
        <p className="text-white/40 text-sm">Use natural language to manage attendance. The AI interprets your command and acts on it.</p>
      </div>

      <Card>
        <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            Commands affect real data. Review the AI interpretation before confirming bulk operations.
          </p>
        </div>

        <Textarea
          label="Enter your command"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          rows={3}
          placeholder='e.g. "Mark all teachers present for today" or "Set all teachers absent for last Friday"'
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_COMMANDS.map((ex) => (
            <button key={ex} onClick={() => setCommand(ex)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 border border-white/10 transition-all">
              {ex}
            </button>
          ))}
        </div>

        <Button onClick={handleSubmit} loading={loading} className="mt-4 w-full" size="lg">
          <Send size={16} />
          Execute Command
        </Button>
      </Card>

      {result && (
        <Card className="animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            {result.executed ? (
              <CheckCircle size={18} className="text-green-400" />
            ) : (
              <Sparkles size={18} className="text-brand-400" />
            )}
            <h3 className="font-display font-semibold text-white">
              {result.executed ? 'Command Executed' : 'AI Interpretation'}
            </h3>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Explanation</div>
              <p className="text-sm text-white/80">{result.interpretation.explanation}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs text-white/40 mb-1">Action</div>
                <div className="text-sm font-mono text-brand-300">{result.interpretation.action}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs text-white/40 mb-1">Status</div>
                <div className={`text-sm font-medium ${result.executed ? 'text-green-400' : 'text-amber-400'}`}>
                  {result.executed ? '✓ Executed' : '⚠ Preview Only'}
                </div>
              </div>
            </div>

            {result.executed && result.upserted !== undefined && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-300">{result.message}</p>
                <p className="text-xs text-green-400/60 mt-0.5">{result.upserted} records created/updated</p>
              </div>
            )}

            {!result.executed && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs text-white/40 mb-2">Parsed Parameters</div>
                <pre className="text-xs text-brand-300 font-mono overflow-auto">
                  {JSON.stringify(result.interpretation.params, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
