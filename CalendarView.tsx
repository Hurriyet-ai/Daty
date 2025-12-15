import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { toast } from 'sonner@2.0.3';
import { ChevronLeft, ChevronRight, Check, X, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

type AvailabilityStatus = 'available' | 'busy' | null;

interface DayAvailability {
  date: string;
  status: AvailabilityStatus;
  availableFriends: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  }>;
}

interface CalendarViewProps {
  userId: string;
}

export function CalendarView({ userId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<Map<string, DayAvailability>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  useEffect(() => {
    loadAvailability();
  }, [currentDate, userId]);

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Kendi müsaitliğimi al
      const { data: myAvailability, error: myError } = await supabase
        .from('availability')
        .select('date, status')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (myError) throw myError;

      // Arkadaşlarımı al
      const { data: friends, error: friendsError } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          profiles!friendships_friend_id_fkey(id, full_name, avatar_url)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const { data: friends2, error: friends2Error } = await supabase
        .from('friendships')
        .select(`
          user_id,
          profiles!friendships_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      if (friendsError || friends2Error) throw friendsError || friends2Error;

      const allFriendIds = [
        ...(friends?.map((f: any) => f.friend_id) || []),
        ...(friends2?.map((f: any) => f.user_id) || [])
      ];

      // Arkadaşların müsaitliğini al
      const { data: friendsAvailability, error: friendsAvailError } = await supabase
        .from('availability')
        .select('user_id, date, status, profiles(id, full_name, avatar_url)')
        .in('user_id', allFriendIds)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .eq('status', 'available');

      if (friendsAvailError) throw friendsAvailError;

      // Verileri birleştir
      const availabilityMap = new Map<string, DayAvailability>();

      // Kendi müsaitliğimi ekle
      myAvailability?.forEach((av: any) => {
        availabilityMap.set(av.date, {
          date: av.date,
          status: av.status,
          availableFriends: []
        });
      });

      // Arkadaşların müsaitliğini ekle
      friendsAvailability?.forEach((av: any) => {
        const existing = availabilityMap.get(av.date) || {
          date: av.date,
          status: null,
          availableFriends: []
        };

        existing.availableFriends.push({
          id: av.profiles.id,
          full_name: av.profiles.full_name,
          avatar_url: av.profiles.avatar_url
        });

        availabilityMap.set(av.date, existing);
      });

      setAvailability(availabilityMap);
    } catch (error: any) {
      toast.error('Müsaitlik bilgileri yüklenemedi');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (date: string, currentStatus: AvailabilityStatus) => {
    try {
      let newStatus: AvailabilityStatus = null;

      if (currentStatus === null) {
        newStatus = 'busy';
      } else if (currentStatus === 'busy') {
        newStatus = 'available';
      } else {
        newStatus = null;
      }

      if (newStatus === null) {
        // Sil
        await supabase
          .from('availability')
          .delete()
          .eq('user_id', userId)
          .eq('date', date);
      } else if (currentStatus === null) {
        // Ekle
        await supabase
          .from('availability')
          .insert({ user_id: userId, date, status: newStatus });
      } else {
        // Güncelle
        await supabase
          .from('availability')
          .update({ status: newStatus })
          .eq('user_id', userId)
          .eq('date', date);
      }

      await loadAvailability();
      toast.success('Müsaitlik güncellendi');
    } catch (error: any) {
      toast.error('Güncelleme başarısız oldu');
      console.error(error);
    }
  };

  const getDateString = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date().toISOString().split('T')[0];

    // Boş hücreler
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    // Günler
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = getDateString(day);
      const dayData = availability.get(dateStr);
      const status = dayData?.status;
      const friendCount = dayData?.availableFriends.length || 0;
      const isToday = dateStr === today;

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(dateStr)}
          className={`
            aspect-square border rounded-lg p-2 cursor-pointer hover:shadow-md transition-all
            ${isToday ? 'ring-2 ring-indigo-500' : ''}
            ${status === 'busy' ? 'bg-red-50 border-red-300' : ''}
            ${status === 'available' ? 'bg-green-50 border-green-300' : ''}
            ${status === null ? 'bg-white border-gray-200' : ''}
          `}
        >
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-start">
              <span className={`${isToday ? 'font-bold text-indigo-600' : ''}`}>
                {day}
              </span>
              {status && (
                <div className="w-2 h-2 rounded-full">
                  {status === 'busy' && <X className="w-3 h-3 text-red-600" />}
                  {status === 'available' && <Check className="w-3 h-3 text-green-600" />}
                </div>
              )}
            </div>
            {friendCount > 0 && (
              <div className="mt-auto">
                <Badge variant="secondary" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {friendCount}
                </Badge>
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const selectedDayData = selectedDate ? availability.get(selectedDate) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
              }
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
              }
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs text-gray-600 font-medium">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {loading ? (
              <div className="col-span-7 text-center py-8 text-gray-500">Yükleniyor...</div>
            ) : (
              renderCalendarDays()
            )}
          </div>
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-50 border border-red-300 rounded" />
              <span>Doluyum</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border border-green-300 rounded" />
              <span>Müsaitim</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Durumunuz:</p>
              <div className="flex gap-2">
                <Button
                  variant={selectedDayData?.status === 'busy' ? 'default' : 'outline'}
                  onClick={() => toggleAvailability(selectedDate!, selectedDayData?.status || null)}
                  className="flex-1"
                >
                  {selectedDayData?.status === 'busy' ? 'Dolu (değiştir)' : 'Dolu işaretle'}
                </Button>
                <Button
                  variant={selectedDayData?.status === 'available' ? 'default' : 'outline'}
                  onClick={() => {
                    if (selectedDayData?.status !== 'available') {
                      toggleAvailability(selectedDate!, selectedDayData?.status || null);
                    }
                  }}
                  className="flex-1"
                >
                  {selectedDayData?.status === 'available' ? 'Müsait (değiştir)' : 'Müsait işaretle'}
                </Button>
              </div>
              {selectedDayData?.status && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAvailability(selectedDate!, selectedDayData?.status || null)}
                  className="w-full mt-2"
                >
                  Durumu temizle
                </Button>
              )}
            </div>

            {selectedDayData?.availableFriends && selectedDayData.availableFriends.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Müsait arkadaşlar ({selectedDayData.availableFriends.length}):
                </p>
                <div className="space-y-2">
                  {selectedDayData.availableFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-2 p-2 bg-green-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        {friend.full_name.charAt(0)}
                      </div>
                      <span>{friend.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDayData?.status === 'available' &&
              (!selectedDayData?.availableFriends || selectedDayData.availableFriends.length === 0) && (
                <p className="text-sm text-gray-500 italic">
                  Bu gün müsait olan başka arkadaş yok
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
