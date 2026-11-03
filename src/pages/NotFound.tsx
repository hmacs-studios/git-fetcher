
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, ArrowLeft } from 'lucide-react';
import Seo from '@/components/Seo'; // Import the Seo component

const NotFound = () => {

  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <Seo
          title="Page Not Found"
          description="The page you are looking for on Medmacs does not exist."
          canonical="https://medmacs.app/404" // Standard practice for 404 pages
        />
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link to="/" className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 shadow-xl animate-scale-in">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <img 
                src="/lovable-uploads/161d7edb-aa7b-4383-a8e2-75b6685fc44f.png" 
                alt="Medmacs Logo" 
                className="w-12 h-12 object-contain"
              />
              <span className="brand-wordmark text-2xl text-gray-900 dark:text-white">Medmacs</span>
            </div>
            <CardTitle className="text-6xl font-bold text-purple-600 dark:text-purple-400 mb-4 animate-fade-in">
              404
            </CardTitle>
            <CardDescription className="text-xl text-gray-900 dark:text-white mb-2">
              Page Not Found
            </CardDescription>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              The page you're looking for doesn't exist or has been moved.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="text-8xl animate-bounce">🔍</div>
            
            <div className="space-y-3">
              <Button 
                asChild 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white hover:scale-105 transition-all duration-200"
              >
                <Link to="/" className="flex items-center justify-center space-x-2">
                  <Home className="w-4 h-4" />
                  <span>Go to Homepage</span>
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                asChild 
                className="w-full border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:scale-105 transition-all duration-200"
              >
                <Link to="/dashboard">
                  Go to Dashboard
                </Link>
              </Button>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400 pt-4">
              <p>Need help? Contact our support team</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
