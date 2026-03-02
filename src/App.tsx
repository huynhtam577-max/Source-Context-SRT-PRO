import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

type Step = 'WAITING_FOR_CONTEXT' | 'WAITING_FOR_SRT' | 'PROCESSING' | 'DONE';

interface Message {
  id: string;
  sender: 'app' | 'user';
  text: string;
  isResult?: boolean;
}

export default function App() {
  const [step, setStep] = useState<Step>('WAITING_FOR_CONTEXT');
  const [contextText, setContextText] = useState('');
  const [srtText, setSrtText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'app', text: 'Cho tôi file Source Context của bạn? (Bạn có thể dán nội dung vào ô bên dưới hoặc tải file lên)' }
  ]);
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const processWithGemini = async (context: string, srt: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Tôi có một Source Context và một file SRT.
Hãy khớp SRT với Source Context và hoàn thành lại Source Context theo thời gian từ SRT.

Yêu cầu output chính xác theo định dạng sau (không thêm bớt text thừa):
SOURCE CONTEXT TIMELINE:
Source Context 1: [Nội dung Source Context 1] : ([Thời gian tương ứng từ SRT])
Source Context 2: [Nội dung Source Context 2] : ([Thời gian tương ứng từ SRT])
...

Lưu ý:
- Từng "Source Context n: ..." phải nằm trên một dòng riêng biệt, không được dính chùm nhau.
- Chỉ xuất ra kết quả, không cần giải thích gì thêm.

Source Context:
${context}

SRT:
${srt}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });
      
      const resultText = response.text || "Không thể tạo kết quả.";
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        sender: 'app', 
        text: resultText,
        isResult: true 
      }]);
      setStep('DONE');
    } catch (error) {
      console.error("Error calling Gemini:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        sender: 'app', 
        text: 'Xin lỗi, đã có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.' 
      }]);
      setStep('DONE');
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    submitInput(inputText);
    setInputText('');
  };

  const submitInput = (text: string) => {
    if (step === 'WAITING_FOR_CONTEXT') {
      setContextText(text);
      setMessages(prev => [
        ...prev, 
        { id: Date.now().toString(), sender: 'user', text: 'Đã cung cấp Source Context.' },
        { id: (Date.now() + 1).toString(), sender: 'app', text: 'Ok. Tôi đã nhận được Source Context. Tiếp theo hãy cung cấp file SRT cho tôi.' }
      ]);
      setStep('WAITING_FOR_SRT');
    } else if (step === 'WAITING_FOR_SRT') {
      setSrtText(text);
      setMessages(prev => [
        ...prev, 
        { id: Date.now().toString(), sender: 'user', text: 'Đã cung cấp file SRT.' },
        { id: (Date.now() + 1).toString(), sender: 'app', text: 'Ok, cảm ơn bạn, tôi đã nhận đủ Source Context và SRT. Bây giờ tôi sẽ tiến hành tạo SOURCE CONTEXT TIMELINE...' }
      ]);
      setStep('PROCESSING');
      processWithGemini(contextText, text);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        submitInput(content);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setStep('WAITING_FOR_CONTEXT');
    setContextText('');
    setSrtText('');
    setMessages([
      { id: Date.now().toString(), sender: 'app', text: 'Cho tôi file Source Context của bạn? (Bạn có thể dán nội dung vào ô bên dưới hoặc tải file lên)' }
    ]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-semibold text-gray-800">SRT Context Aligner</h1>
        {step === 'DONE' && (
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </button>
        )}
      </header>

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
              }`}
            >
              {msg.isResult ? (
                <div className="flex flex-col gap-3">
                  <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {msg.text}
                  </div>
                  <div className="pt-3 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => handleCopy(msg.text)}
                      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Đã copy' : 'Copy kết quả'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {step === 'PROCESSING' && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-500 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Đang xử lý dữ liệu... (Có thể mất vài chục giây)</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto flex gap-3 items-end">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".txt,.srt,.md,text/*"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={step === 'PROCESSING' || step === 'DONE'}
            className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            title="Tải file lên"
          >
            <Paperclip className="w-6 h-6" />
          </button>
          
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={step === 'PROCESSING' || step === 'DONE'}
              placeholder={
                step === 'WAITING_FOR_CONTEXT' ? "Dán Source Context vào đây..." :
                step === 'WAITING_FOR_SRT' ? "Dán nội dung SRT vào đây..." :
                "Đã hoàn thành."
              }
              className="w-full max-h-48 min-h-[56px] p-4 bg-transparent resize-none outline-none text-gray-800 placeholder-gray-400"
              rows={1}
              style={{ height: inputText ? 'auto' : '56px' }}
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || step === 'PROCESSING' || step === 'DONE'}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
            title="Gửi"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
        <div className="max-w-4xl mx-auto mt-2 text-center">
          <p className="text-xs text-gray-400">
            Nhấn Enter để gửi, Shift + Enter để xuống dòng.
          </p>
        </div>
      </footer>
    </div>
  );
}
