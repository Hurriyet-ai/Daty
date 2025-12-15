import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner@2.0.3';
import { UserPlus, Check, X, Trash2, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface Friend {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  profiles: Friend;
}

interface FriendsPanelProps {
  userId: string;
}

export function FriendsPanel({ userId }: FriendsPanelProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, [userId]);

  const loadFriends = async () => {
    try {
      // Giden arkadaşlıklar
      const { data: outgoing, error: error1 } = await supabase
        .from('friendships')
        .select('friend_id, profiles!friendships_friend_id_fkey(id, full_name, email, avatar_url)')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      // Gelen arkadaşlıklar
      const { data: incoming, error: error2 } = await supabase
        .from('friendships')
        .select('user_id, profiles!friendships_user_id_fkey(id, full_name, email, avatar_url)')
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      if (error1 || error2) throw error1 || error2;

      const allFriends = [
        ...(outgoing?.map((f: any) => f.profiles) || []),
        ...(incoming?.map((f: any) => f.profiles) || [])
      ];

      setFriends(allFriends);
    } catch (error: any) {
      console.error('Arkadaşlar yüklenemedi:', error);
    }
  };

  const loadRequests = async () => {
    try {
      // Gelen istekler
      const { data: incoming, error: error1 } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status, profiles!friendships_user_id_fkey(id, full_name, email, avatar_url)')
        .eq('friend_id', userId)
        .eq('status', 'pending');

      // Giden istekler
      const { data: outgoing, error: error2 } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status, profiles!friendships_friend_id_fkey(id, full_name, email, avatar_url)')
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error1 || error2) throw error1 || error2;

      setPendingRequests(incoming || []);
      setSentRequests(outgoing || []);
    } catch (error: any) {
      console.error('İstekler yüklenemedi:', error);
    }
  };

  const sendFriendRequest = async () => {
    if (!searchEmail.trim()) {
      toast.error('Lütfen bir e-posta adresi girin');
      return;
    }

    setLoading(true);
    try {
      // Kullanıcıyı bul
      const { data: targetUser, error: searchError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', searchEmail.trim())
        .single();

      if (searchError || !targetUser) {
        toast.error('Kullanıcı bulunamadı');
        return;
      }

      if (targetUser.id === userId) {
        toast.error('Kendinize istek gönderemezsiniz');
        return;
      }

      // Mevcut arkadaşlık kontrolü
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`)
        .single();

      if (existing) {
        if (existing.status === 'accepted') {
          toast.error('Bu kullanıcı zaten arkadaşınız');
        } else {
          toast.error('Bu kullanıcıya zaten istek gönderdiniz');
        }
        return;
      }

      // Arkadaşlık isteği gönder
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: targetUser.id,
          status: 'pending'
        });

      if (insertError) throw insertError;

      toast.success('Arkadaşlık isteği gönderildi');
      setSearchEmail('');
      loadRequests();
    } catch (error: any) {
      toast.error('İstek gönderilemedi: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const respondToRequest = async (requestId: string, accept: boolean) => {
    try {
      if (accept) {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (error) throw error;
        toast.success('Arkadaşlık isteği kabul edildi');
      } else {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('id', requestId);

        if (error) throw error;
        toast.success('Arkadaşlık isteği reddedildi');
      }

      loadFriends();
      loadRequests();
    } catch (error: any) {
      toast.error('İşlem başarısız oldu');
      console.error(error);
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (error) throw error;

      toast.success('Arkadaş kaldırıldı');
      loadFriends();
    } catch (error: any) {
      toast.error('Arkadaş kaldırılamadı');
      console.error(error);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('İstek iptal edildi');
      loadRequests();
    } catch (error: any) {
      toast.error('İstek iptal edilemedi');
      console.error(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arkadaşlarım</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Arkadaş e-postası..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
            />
            <Button onClick={sendFriendRequest} disabled={loading}>
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>

          <Tabs defaultValue="friends">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends">
                Arkadaşlar
                {friends.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{friends.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="requests">
                İstekler
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent">
                Gönderilen
                {sentRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{sentRequests.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="space-y-2">
              {friends.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Henüz arkadaşınız yok. Yukarıdaki arama kutusunu kullanarak arkadaş ekleyin.
                </p>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        {friend.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{friend.full_name}</p>
                        <p className="text-sm text-gray-600">{friend.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFriend(friend.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="requests" className="space-y-2">
              {pendingRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Bekleyen arkadaşlık isteğiniz yok
                </p>
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        {request.profiles.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{request.profiles.full_name}</p>
                        <p className="text-sm text-gray-600">{request.profiles.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => respondToRequest(request.id, true)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => respondToRequest(request.id, false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="sent" className="space-y-2">
              {sentRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Gönderilen istek yok
                </p>
              ) : (
                sentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        {request.profiles.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{request.profiles.full_name}</p>
                        <p className="text-sm text-gray-600">{request.profiles.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelRequest(request.id)}
                    >
                      İptal
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
