import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "../theme/colors";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
};

/** Tarjeta reutilizable. Si recibe onPress se comporta como botón. */
export function Card({ children, onPress }: Props) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      style={styles.card}
      activeOpacity={0.8}
    >
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
});
