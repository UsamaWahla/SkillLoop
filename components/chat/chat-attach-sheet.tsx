import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Layout, type AppThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type ChatAttachSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
};

export function ChatAttachSheet({
  visible,
  onClose,
  onPickGallery,
  onPickDocument,
}: ChatAttachSheetProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Attach</Text>
          <AttachRow
            icon="images-outline"
            label="Photos & videos"
            subtitle="From gallery"
            onPress={() => run(onPickGallery)}
            theme={theme}
          />
          <AttachRow
            icon="document-attach-outline"
            label="Document"
            subtitle="PDF, files, and more"
            onPress={() => run(onPickDocument)}
            theme={theme}
          />
        </View>
      </View>
    </Modal>
  );
}

function AttachRow({
  icon,
  label,
  subtitle,
  onPress,
  theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle: string;
  onPress: () => void;
  theme: AppThemeColors;
}) {
  return (
    <Pressable style={attachStyles(theme).row} onPress={onPress}>
      <View style={attachStyles(theme).iconWrap}>
        <Ionicons name={icon} size={24} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={attachStyles(theme).label}>{label}</Text>
        <Text style={attachStyles(theme).subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function attachStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
  });
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: Layout.radiusLg,
      borderTopRightRadius: Layout.radiusLg,
      paddingHorizontal: Layout.screenPadding,
      paddingTop: 16,
      paddingBottom: 28,
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
    },
  });
}
