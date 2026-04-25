import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { Deal } from '@/types/deal';
import { formatPrice } from './deals';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('deals', {
      name: 'Ofertas',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F97316',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function notifyNewDeal(deal: Deal): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 ${deal.title}`,
      body: deal.oldPrice
        ? `De ${formatPrice(deal.oldPrice)} por ${formatPrice(deal.price)}`
        : `Por ${formatPrice(deal.price)}`,
      data: { dealId: deal.id, url: deal.url },
    },
    trigger: null,
  });
}

export async function notifyNewDeals(deals: Deal[]): Promise<void> {
  for (const deal of deals.slice(0, 3)) {
    await notifyNewDeal(deal);
  }
}
