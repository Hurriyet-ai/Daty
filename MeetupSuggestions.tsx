import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar, Users, Sparkles } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface MeetupDay {
  date: string;
  friends: Array<{
    id: string;
    full_name: string;
  }>;
}

interface MeetupSuggestionsProps {
  userId: string;
}

export function MeetupSuggestions({ userId }: MeetupSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<MeetupDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, [userId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      // Kendi müsait günlerimi al
      const { data: myAvailability, error: myError } = await supabase
        .from('availability')
        .select('date')
        .eq('user_id', userId)
        .eq('status', 'available')
        .gte('date', today.toISOString().split('T')[0])
        .lte('date', nextWeek.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (myError) throw myError;

      if (!myAvailability || myAvailability.length === 0) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      const myAvailableDates = myAvailability.map((a) => a.date);

      // Arkadaşlarımı al
      const { data: friends1, error: f1Error } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const { data: friends2, error: f2Error } = await supabase
        .from('friendships')
        .select('user_id')
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      if (f1Error || f2Error) throw f1Error || f2Error;

      const friendIds = [
        ...(friends1?.map((f) => f.friend_id) || []),
        ...(friends2?.map((f) => f.user_id) || [])
      ];

      if (friendIds.length === 0) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      // Arkadaşların bu tarihlerdeki müsaitliğini al
      const { data: friendsAvailability, error: faError } = await supabase
        .from('availability')
        .select('date, user_id, profiles(id, full_name)')
        .in('user_id', friendIds)
        .in('date', myAvailableDates)
        .eq('status', 'available');

      if (faError) throw faError;

      // Tarihlere göre grupla
      const dateMap = new Map<string, MeetupDay>();

      myAvailableDates.forEach((date) => {
        dateMap.set(date, {
          date,
          friends: []
        });
      });

      friendsAvailability?.forEach((av: any) => {
        const day = dateMap.get(av.date);
        if (day) {
          day.friends.push({
            id: av.profiles.id,
            full_name: av.profiles.full_name
          });
        }
      });

      // En az 1 arkadaşın olduğu günleri göster
      const validSuggestions = Array.from(dateMap.values())
        .filter((day) => day.friends.length > 0)
        .sort((a, b) => b.friends.length - a.friends.length);

      setSuggestions(validSuggestions);
    } catch (error: any) {
      toast.error('Öneriler yüklenemedi');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.getTime() === today.getTime()) {
      return 'Bugün';
    } else if (date.getTime() === tomorrow.getTime()) {
      return 'Yarın';
    }

    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Buluşma Önerileri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">Yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Buluşma Önerileri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">
            Önümüzdeki 7 gün içinde müsait olduğunuz bir gün yok veya arkadaşlarınız müsait değil.
            Takvimde müsait olduğunuz günleri işaretleyin!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Buluşma Önerileri
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.date}
              className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="font-medium">{formatDate(suggestion.date)}</span>
                </div>
                <Badge variant="secondary">
                  <Users className="w-3 h-3 mr-1" />
                  {suggestion.friends.length}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestion.friends.map((friend) => (
                  <Badge key={friend.id} variant="outline">
                    {friend.full_name}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
