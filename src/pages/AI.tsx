import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Zap, Brain, FileText, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import Seo from '@/components/Seo'; // Import the Seo component

const AI = () => {
  const { user } = useAuth();

  // Get user profile data
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id
  });

  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-900">
      {/* Add the Seo component here */}
      <Seo
        title="AI Study Assistant"
        description="Leverage the Medmacs AI Study Assistant for personalized learning, including an AI Chatbot and AI Test Generator for medical exam preparation."
        canonical="https://medmacs.app/ai" // Replace with your actual domain if applicable
      />
 

 

      <div className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Hero Section */}
        <div className="text-center mb-8 animate-fade-in overscroll-y-contain">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🤖 AI Study Assistant
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Choose your preferred AI study method. Get personalized help with your medical studies.
          </p>
        </div>

        {/* Main AI Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-4xl mx-auto">
          <Link to="/ai/chatbot">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800 hover:scale-105 hover:shadow-lg transition-all duration-300 animate-fade-in cursor-pointer h-full">
              <CardHeader className="text-center pb-4">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-gray-900 dark:text-white text-xl mb-2">AI Study Chatbot</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Get instant answers to your medical questions and study help through interactive chat
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                  Start Chatting
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to="/ai/test-generator">
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800 hover:scale-105 hover:shadow-lg transition-all duration-300 animate-fade-in cursor-pointer h-full">
              <CardHeader className="text-center pb-4">
                <FileText className="h-12 w-12 mx-auto mb-4 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-gray-900 dark:text-white text-xl mb-2">AI Test Generator</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Generate personalized practice tests with custom difficulty and topics
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full">
                  Generate Test
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:scale-105 transition-transform duration-300 animate-fade-in">
            <CardHeader className="text-center">
              <Bot className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-gray-900 dark:text-white">AI-Powered</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Advanced AI technology for medical education
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:scale-105 transition-transform duration-300 animate-fade-in">
            <CardHeader className="text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <CardTitle className="text-gray-900 dark:text-white">Smart Learning</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Adaptive learning that matches your pace
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:scale-105 transition-transform duration-300 animate-fade-in">
            <CardHeader className="text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
              <CardTitle className="text-gray-900 dark:text-white">Instant Results</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Get immediate feedback and explanations
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg text-sm text-blue-800 dark:text-blue-200 max-w-4xl mx-auto">
          <div className="flex items-start space-x-2">
            <Bot className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-2">How AI Study Assistant works:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>AI Chatbot:</strong> Ask questions and get detailed explanations on any medical topic</li>
                <li>• <strong>Test Generator:</strong> Create custom practice tests with AI-generated questions</li>
                <li>• <strong>Progress Tracking:</strong> Monitor your learning progress and identify areas for improvement</li>
                <li>• <strong>Personalized Learning:</strong> AI adapts to your learning style and knowledge level</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default AI;
