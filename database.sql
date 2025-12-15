-- Profil tablosu oluştur
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Arkadaşlık tablosu oluştur
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Müsaitlik tablosu oluştur
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'busy')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Row Level Security (RLS) etkinleştir
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

-- Profil politikaları
CREATE POLICY "Herkes kendi profilini görebilir" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Herkes kendi profilini oluşturabilir" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Herkes kendi profilini güncelleyebilir" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Arkadaşlık politikaları
CREATE POLICY "Kullanıcılar kendi arkadaşlıklarını görebilir" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Kullanıcılar arkadaşlık isteği gönderebilir" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi gelen isteklerini güncelleyebilir" ON friendships
  FOR UPDATE USING (auth.uid() = friend_id OR auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi arkadaşlıklarını silebilir" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Müsaitlik politikaları
CREATE POLICY "Arkadaşlar birbirlerinin müsaitliğini görebilir" ON availability
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM friendships
      WHERE (user_id = auth.uid() AND friend_id = availability.user_id AND status = 'accepted')
         OR (friend_id = auth.uid() AND user_id = availability.user_id AND status = 'accepted')
    )
  );

CREATE POLICY "Kullanıcılar kendi müsaitliğini oluşturabilir" ON availability
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi müsaitliğini güncelleyebilir" ON availability
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi müsaitliğini silebilir" ON availability
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: Yeni kullanıcı kaydolduğunda otomatik profil oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- İndeksler (performans için)
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_availability_user_id ON availability(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(date);
