import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthForm } from './components/AuthForm';
import { CalendarView } from './components/CalendarView';
import { FriendsPanel } from './components/FriendsPanel';
import { MeetupSuggestions } from './components/MeetupSuggestions';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import { LogOut, Calendar, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import type { User } from '@supabase/supabase-js';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'calendar' | 'friends'>('calendar');

  useEffect(() => {
    // Mevcut oturumu kontrol et
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    // Auth değişikliklerini dinle
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Profil yüklenemedi:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Çıkış yapıldı');
    } catch (error: any) {
      toast.error('Çıkış yapılamadı');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthForm />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Toaster />
      
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl">Sosyal Takvim</h1>
              {profile && (
                <p className="text-sm text-gray-600">Hoş geldin, {profile.full_name}!</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Mobile Navigation */}
        <div className="lg:hidden mb-6 flex gap-2">
          <Button
            variant={activeView === 'calendar' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveView('calendar')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Takvim
          </Button>
          <Button
            variant={activeView === 'friends' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveView('friends')}
          >
            <UsersIcon className="w-4 h-4 mr-2" />
            Arkadaşlar
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar Section - Desktop always visible, mobile conditional */}
          <div className={`lg:col-span-2 ${activeView === 'calendar' ? 'block' : 'hidden lg:block'}`}>
            <div className="space-y-6">
              <CalendarView userId={user.id} />
              <MeetupSuggestions userId={user.id} />
            </div>
          </div>

          {/* Friends Section - Desktop always visible, mobile conditional */}
          <div className={`lg:col-span-1 ${activeView === 'friends' ? 'block' : 'hidden lg:block'}`}>
            <FriendsPanel userId={user.id} />
          </div>
        </div>
      </main>

      {/* Setup Instructions */}
      {!profile && (
        <div className="fixed bottom-4 right-4 max-w-md bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
          <p className="text-sm">
            <strong>Dikkat:</strong> Veritabanı tablolarını oluşturmayı unutmayın!
            <code className="block mt-2 text-xs bg-white p-2 rounded">
              /lib/database.sql
            </code>
            dosyasındaki SQL komutlarını Supabase SQL Editor'de çalıştırın.
          </p>
        </div>
      )}
    </div>
  );
}
