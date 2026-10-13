import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SettingsPage, Section, SwitchRow } from '../../components/settings/SettingsUI';
import { NOTIFICATION_GROUPS } from '../../constants/Settings';

/** Notifications (maquette 30) : chaque interrupteur est enregistré aussitôt */
export default function NotificationsScreen() {
  const { user, updateProfile } = useAuth();
  const [values, setValues] = useState(user?.settings?.notifications ?? {});

  const toggle = async (key, value) => {
    const previous = values;
    setValues(v => ({ ...v, [key]: value }));
    try {
      await updateProfile({ settings: { notifications: { [key]: value } } });
    } catch {
      setValues(previous);
      Alert.alert('Notifications', "Impossible d'enregistrer ce réglage.");
    }
  };

  return (
    <SettingsPage title="Notifications">
      {NOTIFICATION_GROUPS.map((group, i) => (
        <Section key={i} title={group.title}>
          {group.items.map(item => (
            <SwitchRow key={item.key} title={item.title} subtitle={item.subtitle}
              value={values[item.key]} onChange={(v) => toggle(item.key, v)} />
          ))}
        </Section>
      ))}
    </SettingsPage>
  );
}
