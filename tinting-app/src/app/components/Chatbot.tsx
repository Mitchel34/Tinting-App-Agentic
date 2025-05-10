'use client';

import { useState, useRef, useEffect } from 'react';

interface FAQ {
  question: string;
  answer: string;
  keywords: string[];
}

const faqs: FAQ[] = [
  {
    question: "What is window tinting?",
    answer: "Window tinting is the process of applying a thin laminate film to a vehicle's glass in order to darken it. This film can help reduce heat, glare, and UV radiation, as well as improve privacy and aesthetics.",
    keywords: ["what", "window tinting", "tint", "define"],
  },
  {
    question: "How much does window tinting cost?",
    answer: "The cost of window tinting can vary depending on the type of film, the size of your vehicle, and the number of windows being tinted. Our Standard Tint starts at $200, and Premium Tint starts at $350. For a more precise quote, please contact us.",
    keywords: ["how much", "cost", "price", "pricing", "standard tint", "premium tint"],
  },
  {
    question: "How long does window tinting last?",
    answer: "High-quality window tint can last for many years, often 10 years or more, depending on the film quality, climate, and how well it's cared for. We use durable films designed for longevity.",
    keywords: ["how long", "last", "duration", "lifespan", "durability"],
  },
  {
    question: "Is window tinting legal?",
    answer: "Window tinting laws vary by state and country. Generally, there are restrictions on how dark the tint can be, especially on the front windshield and front side windows. We are knowledgeable about local regulations and can help you choose a legal tint.",
    keywords: ["legal", "laws", "regulations", "restrictions", "allowed"],
  },
  {
    question: "What are the benefits of window tinting?",
    answer: "Benefits include reduced heat and glare, UV protection for your skin and car interior, increased privacy and security, and enhanced vehicle appearance.",
    keywords: ["benefits", "advantages", "why tint", "purpose"],
  },
  {
    question: "How do I care for my tinted windows?",
    answer: "After tinting, wait a few days before rolling down your windows. Clean tinted windows with ammonia-free cleaners and a soft cloth or paper towel. Avoid abrasive materials.",
    keywords: ["care", "clean", "maintain", "aftercare", "cleaning"],
  },
];

interface Message {
  text: string;
  sender: 'user' | 'bot';
  isFAQ?: boolean;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hello! How can I help you today? Ask a question or choose one below.", sender: 'bot' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = (text?: string) => {
    const query = text || inputValue.trim();
    if (!query) return;

    const userMessage: Message = { text: query, sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Simple keyword matching
    let foundAnswer: string | null = null;
    let bestMatchScore = 0;

    faqs.forEach(faq => {
      let currentScore = 0;
      faq.keywords.forEach(keyword => {
        if (query.toLowerCase().includes(keyword.toLowerCase())) {
          currentScore++;
        }
      });
      // Prioritize questions that contain more keywords
      if (currentScore > bestMatchScore) {
        bestMatchScore = currentScore;
        foundAnswer = faq.answer;
      } else if (currentScore > 0 && currentScore === bestMatchScore) {
        // If scores are equal, append if not already part of the answer
        if (foundAnswer && !foundAnswer.includes(faq.answer)) {
            foundAnswer += `\n\n${faq.answer}`;
        }
      }
    });

    if (foundAnswer && bestMatchScore > 0) {
      setMessages((prevMessages) => [...prevMessages, { text: foundAnswer!, sender: 'bot' }]);
    } else {
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: "Sorry, I couldn't find an answer to that. Please try rephrasing or ask another question.", sender: 'bot' },
      ]);
    }

    if (!text) { // Only clear input if it was a typed message
        setInputValue('');
    }
  };

  const handleFAQClick = (question: string) => {
    handleSendMessage(question);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 z-50"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.86 8.25-8.625 8.25S3.75 16.556 3.75 12s3.86-8.25 8.625-8.25S21 7.444 21 12z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 w-full max-w-sm bg-white rounded-lg shadow-xl border border-gray-200 z-40 flex flex-col" style={{ height: '70vh', maxHeight: '500px' }}>
          <div className="p-4 border-b bg-indigo-600 text-white rounded-t-lg">
            <h3 className="text-lg font-semibold">Chat with us!</h3>
          </div>
          <div className="flex-grow p-4 space-y-3 overflow-y-auto bg-gray-50">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-800'
                    }`}
                >
                  {msg.text.split('\n').map((line, i) => (
                    <span key={i} style={{display: 'block'}}>{line}</span>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-2 border-t bg-gray-50">
            <div className="text-sm text-gray-600 mb-2 px-2">Or click a common question:</div>
            <div className="flex flex-wrap gap-2 px-2 mb-2">
                {faqs.slice(0, 3).map(faq => (
                    <button 
                        key={faq.question}
                        onClick={() => handleFAQClick(faq.question)}
                        className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded-full"
                    >
                        {faq.question}
                    </button>
                ))}
            </div>
          </div>
          <div className="p-4 border-t bg-white rounded-b-lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
