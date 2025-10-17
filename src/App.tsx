import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, Circle, AlertCircle, ArrowLeft, ArrowRight, Mail, PlayCircle, RotateCcw, Trophy } from 'lucide-react';

// Utility Functions
const decodeHTML = (html) => {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Storage Manager
class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'quiz_logs';
  }

  getLogs() {
    try {
      const logs = localStorage.getItem(this.STORAGE_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Error reading logs:', error);
      return [];
    }
  }

  addLog(logEntry) {
    try {
      const logs = this.getLogs();
      logs.push({
        ...logEntry,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Error saving log:', error);
    }
  }

  saveQuizStart(email) {
    this.addLog({
      type: 'quiz_start',
      email,
      action: 'Quiz started'
    });
  }

  saveAnswer(email, questionIndex, question, selectedAnswer, correctAnswer) {
    this.addLog({
      type: 'answer_saved',
      email,
      questionIndex,
      question,
      selectedAnswer,
      correctAnswer,
      isCorrect: selectedAnswer === correctAnswer
    });
  }

  saveQuizCompletion(email, score, totalQuestions, timeTaken) {
    this.addLog({
      type: 'quiz_completed',
      email,
      score,
      totalQuestions,
      percentage: ((score / totalQuestions) * 100).toFixed(2),
      timeTaken
    });
  }

  exportLogs() {
    const logs = this.getLogs();
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quiz_logs_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

const storage = new StorageManager();

// Quiz Context
const QuizContext = createContext();

const QuizProvider = ({ children }) => {
  const [email, setEmail] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState(new Set([0]));
  const [timeRemaining, setTimeRemaining] = useState(30 * 60);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState('start');

  useEffect(() => {
    if (currentPage === 'quiz' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentPage, timeRemaining]);

  const getFallbackQuestions = () => {
    return [
      { question: "What is the capital of France?", correctAnswer: "Paris", allAnswers: ["Paris", "London", "Berlin", "Madrid"], category: "Geography", difficulty: "easy" },
      { question: "Which planet is known as the Red Planet?", correctAnswer: "Mars", allAnswers: ["Mars", "Venus", "Jupiter", "Saturn"], category: "Science", difficulty: "easy" },
      { question: "Who wrote 'Romeo and Juliet'?", correctAnswer: "William Shakespeare", allAnswers: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], category: "Literature", difficulty: "medium" },
      { question: "What is the largest ocean on Earth?", correctAnswer: "Pacific Ocean", allAnswers: ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], category: "Geography", difficulty: "easy" },
      { question: "In which year did World War II end?", correctAnswer: "1945", allAnswers: ["1945", "1944", "1946", "1943"], category: "History", difficulty: "medium" },
      { question: "What is the chemical symbol for gold?", correctAnswer: "Au", allAnswers: ["Au", "Ag", "Fe", "Cu"], category: "Science", difficulty: "medium" },
      { question: "Which programming language is known for web development?", correctAnswer: "JavaScript", allAnswers: ["JavaScript", "Python", "C++", "Java"], category: "Technology", difficulty: "easy" },
      { question: "What is the smallest prime number?", correctAnswer: "2", allAnswers: ["2", "1", "3", "5"], category: "Mathematics", difficulty: "easy" },
      { question: "Who painted the Mona Lisa?", correctAnswer: "Leonardo da Vinci", allAnswers: ["Leonardo da Vinci", "Pablo Picasso", "Vincent van Gogh", "Michelangelo"], category: "Art", difficulty: "easy" },
      { question: "What is the speed of light in vacuum (approximately)?", correctAnswer: "300,000 km/s", allAnswers: ["300,000 km/s", "150,000 km/s", "450,000 km/s", "200,000 km/s"], category: "Physics", difficulty: "hard" },
      { question: "Which country is home to the kangaroo?", correctAnswer: "Australia", allAnswers: ["Australia", "New Zealand", "South Africa", "Brazil"], category: "Geography", difficulty: "easy" },
      { question: "What is the largest mammal in the world?", correctAnswer: "Blue Whale", allAnswers: ["Blue Whale", "Elephant", "Giraffe", "Polar Bear"], category: "Biology", difficulty: "easy" },
      { question: "In which year was the first iPhone released?", correctAnswer: "2007", allAnswers: ["2007", "2005", "2008", "2006"], category: "Technology", difficulty: "medium" },
      { question: "What is the currency of Japan?", correctAnswer: "Yen", allAnswers: ["Yen", "Won", "Yuan", "Dollar"], category: "Economics", difficulty: "easy" },
      { question: "Which element has the atomic number 1?", correctAnswer: "Hydrogen", allAnswers: ["Hydrogen", "Helium", "Oxygen", "Carbon"], category: "Chemistry", difficulty: "medium" }
    ].map(q => ({ ...q, allAnswers: shuffleArray(q.allAnswers), type: 'multiple' }));
  };

  const fetchQuestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('https://opentdb.com/api.php?amount=15&category=9&type=multiple');
      
      if (!response.ok) {
        throw new Error('API not available');
      }
      
      const data = await response.json();
      
      if (data.response_code !== 0) {
        throw new Error('API returned error');
      }

      const processedQuestions = data.results.map(q => ({
        question: decodeHTML(q.question),
        correctAnswer: decodeHTML(q.correct_answer),
        allAnswers: shuffleArray([
          decodeHTML(q.correct_answer),
          ...q.incorrect_answers.map(a => decodeHTML(a))
        ]),
        type: q.type,
        category: decodeHTML(q.category),
        difficulty: q.difficulty
      }));

      setQuestions(processedQuestions);
      setQuizStartTime(Date.now());
      storage.saveQuizStart(email);
      setCurrentPage('quiz');
    } catch (err) {
      console.log('Using fallback questions due to API error:', err);
      // Use fallback questions
      const fallbackQuestions = getFallbackQuestions();
      setQuestions(fallbackQuestions);
      setQuizStartTime(Date.now());
      storage.saveQuizStart(email);
      setCurrentPage('quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const selectAnswer = (answer) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
  };

  const clearAnswer = () => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[currentQuestionIndex];
      return newAnswers;
    });
  };

  const goToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setVisitedQuestions(prev => new Set([...prev, index]));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = useCallback(() => {
    const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);
    
    questions.forEach((q, idx) => {
      storage.saveAnswer(
        email,
        idx,
        q.question,
        answers[idx] || 'Not answered',
        q.correctAnswer
      );
    });

    const score = questions.reduce((acc, q, idx) => {
      return acc + (answers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);

    storage.saveQuizCompletion(email, score, questions.length, timeTaken);
    setCurrentPage('results');
  }, [email, questions, answers, quizStartTime]);

  const resetQuiz = () => {
    setEmail('');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setVisitedQuestions(new Set([0]));
    setTimeRemaining(30 * 60);
    setQuizStartTime(null);
    setCurrentPage('start');
    setError(null);
  };

  return (
    <QuizContext.Provider value={{
      email, setEmail,
      questions, fetchQuestions,
      currentQuestionIndex, goToQuestion,
      answers, selectAnswer, clearAnswer,
      visitedQuestions,
      timeRemaining,
      isLoading, error,
      currentPage,
      nextQuestion, previousQuestion,
      handleSubmitQuiz,
      resetQuiz
    }}>
      {children}
    </QuizContext.Provider>
  );
};

const useQuiz = () => {
  const context = useContext(QuizContext);
  if (!context) throw new Error('useQuiz must be used within QuizProvider');
  return context;
};

// Start Page Component
const StartPage = () => {
  const { email, setEmail, fetchQuestions, isLoading, error } = useQuiz();
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleStart = () => {
    if (!email) {
      setEmailError('Please enter your email address');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    fetchQuestions();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#DAD2FF] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 md:p-12">
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-[#493D9E] mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Quiz Challenge</h1>
          <p className="text-gray-600">Test your knowledge with 15 challenging questions</p>
        </div>

        <div className="bg-[#FFF2AF] rounded-lg p-6 mb-8">
          <h2 className="font-semibold text-lg text-[#493D9E] mb-3">Quiz Rules:</h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-[#493D9E] mr-2 flex-shrink-0 mt-0.5" />
              <span>15 multiple choice questions to answer</span>
            </li>
            <li className="flex items-start">
              <Clock className="w-5 h-5 text-[#493D9E] mr-2 flex-shrink-0 mt-0.5" />
              <span>30 minutes time limit</span>
            </li>
            <li className="flex items-start">
              <ArrowRight className="w-5 h-5 text-[#493D9E] mr-2 flex-shrink-0 mt-0.5" />
              <span>Navigate between questions anytime</span>
            </li>
            <li className="flex items-start">
              <AlertCircle className="w-5 h-5 text-[#493D9E] mr-2 flex-shrink-0 mt-0.5" />
              <span>Quiz auto-submits when time expires</span>
            </li>
          </ul>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError('');
            }}
            placeholder="your.email@example.com"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#493D9E] focus:outline-none transition"
          />
          {emailError && (
            <p className="text-red-500 text-sm mt-2">{emailError}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full bg-[#493D9E] hover:opacity-90 text-white font-semibold py-4 rounded-lg transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Loading Questions...
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5 mr-2" />
              Start Quiz
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Quiz Page Component
const QuizPage = () => {
  const {
    questions,
    currentQuestionIndex,
    answers,
    selectAnswer,
    clearAnswer,
    visitedQuestions,
    timeRemaining,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    handleSubmitQuiz
  } = useQuiz();

  const currentQuestion = questions[currentQuestionIndex];
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const getQuestionStatus = (index) => {
    if (answers[index] !== undefined) return 'answered';
    if (visitedQuestions.has(index)) return 'visited';
    return 'not-visited';
  };

  const handleSubmit = () => {
    const unanswered = questions.length - Object.keys(answers).length;
    if (unanswered > 0) {
      setShowSubmitConfirm(true);
    } else {
      handleSubmitQuiz();
    }
  };

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Timer */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Quiz Challenge</h1>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-semibold ${
            timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-[#DAD2FF] text-[#493D9E]'
          }`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeRemaining)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Overview Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-4">
              <h2 className="font-semibold text-gray-700 mb-4">Questions Overview</h2>
              <div className="grid grid-cols-5 lg:grid-cols-3 gap-2">
                {questions.map((_, idx) => {
                  const status = getQuestionStatus(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => goToQuestion(idx)}
                      className={`aspect-square rounded-lg font-semibold transition ${
                        idx === currentQuestionIndex
                          ? 'bg-[#493D9E] text-white ring-2 ring-[#B2A5FF]'
                          : status === 'answered'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : status === 'visited'
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 rounded"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 rounded"></div>
                  <span>Visited</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span>Not Visited</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Question Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-6">
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-medium text-[#493D9E] bg-[#FFF2AF] px-3 py-1 rounded-full">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-sm text-gray-500 capitalize">
                  {currentQuestion.difficulty}
                </span>
              </div>

              <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6">
                {currentQuestion.question}
              </h2>

              <div className="space-y-3 mb-8">
                {currentQuestion.allAnswers.map((answer, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAnswer(answer)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition ${
                      answers[currentQuestionIndex] === answer
                        ? 'border-[#493D9E] bg-[#FFF2AF]'
                        : 'border-gray-200 hover:border-[#B2A5FF] hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                        answers[currentQuestionIndex] === answer
                          ? 'border-[#493D9E] bg-[#493D9E]'
                          : 'border-gray-300'
                      }`}>
                        {answers[currentQuestionIndex] === answer && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <span className="text-gray-700">{answer}</span>
                    </div>
                  </button>
                ))}
              </div>

              {answers[currentQuestionIndex] && (
                <button
                  onClick={clearAnswer}
                  className="text-red-600 hover:text-red-700 font-medium mb-4"
                >
                  Clear Selection
                </button>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={previousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Previous
                </button>

                {currentQuestionIndex === questions.length - 1 ? (
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                  >
                    Submit Quiz
                    <CheckCircle className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={nextQuestion}
                    className="flex items-center gap-2 px-6 py-3 bg-[#493D9E] hover:opacity-90 text-white font-medium rounded-lg transition"
                  >
                    Next
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Submit Quiz?</h3>
            <p className="text-gray-600 mb-6">
              You have {questions.length - Object.keys(answers).length} unanswered question(s). 
              Are you sure you want to submit?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  handleSubmitQuiz();
                }}
                className="flex-1 px-4 py-2 bg-[#493D9E] hover:opacity-90 text-white font-medium rounded-lg transition"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Results Page Component
const ResultsPage = () => {
  const { questions, answers, email, resetQuiz } = useQuiz();

  const score = questions.reduce((acc, q, idx) => {
    return acc + (answers[idx] === q.correctAnswer ? 1 : 0);
  }, 0);

  const percentage = ((score / questions.length) * 100).toFixed(2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#DAD2FF] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Score Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8 text-center">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Quiz Completed!</h1>
          <p className="text-gray-600 mb-6">{email}</p>
          
          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto mb-6">
            <div className="bg-[#FFF2AF] rounded-lg p-4">
              <p className="text-[#493D9E] text-sm font-medium mb-1">Score</p>
              <p className="text-3xl font-bold text-[#493D9E]">
                {score}/{questions.length}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-green-600 text-sm font-medium mb-1">Percentage</p>
              <p className="text-3xl font-bold text-green-900">{percentage}%</p>
            </div>
          </div>

          <button
            onClick={resetQuiz}
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#493D9E] hover:opacity-90 text-white font-semibold rounded-lg transition"
          >
            <RotateCcw className="w-5 h-5" />
            Take Another Quiz
          </button>
        </div>

        {/* Detailed Results */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Review Your Answers</h2>
          
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAnswer = answers[idx];
              const isCorrect = userAnswer === q.correctAnswer;
              
              return (
                <div
                  key={idx}
                  className={`p-6 rounded-lg border-2 ${
                    isCorrect
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    {isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 mb-2">
                        Question {idx + 1}: {q.question}
                      </p>
                      
                      <div className="space-y-2 text-sm">
                        <p className="text-gray-700">
                          <span className="font-medium">Your Answer: </span>
                          <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                            {userAnswer || 'Not answered'}
                          </span>
                        </p>
                        
                        {!isCorrect && (
                          <p className="text-gray-700">
                            <span className="font-medium">Correct Answer: </span>
                            <span className="text-green-700">{q.correctAnswer}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>All quiz data has been saved to local storage logs</p>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const { currentPage } = useQuiz();

  return (
    <>
      {currentPage === 'start' && <StartPage />}
      {currentPage === 'quiz' && <QuizPage />}
      {currentPage === 'results' && <ResultsPage />}
    </>
  );
};

// Root Component with Provider
const QuizApp = () => {
  return (
    <QuizProvider>
      <App />
    </QuizProvider>
  );
};

export default QuizApp;