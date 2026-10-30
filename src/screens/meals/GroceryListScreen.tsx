import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Path, Circle } from "react-native-svg";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import {
  getGroceryList,
  setGroceryItemChecked,
  addGroceryItem,
  removeGroceryItem,
  amountLabel,
  GroceryItem,
} from "../../services/grocery";

type Props = NativeStackScreenProps<MainStackParamList, "GroceryList">;

/**
 * Grocery List — Lang's frame 5039:28486.
 *
 * Sections are shelf categories ("Produce", "Meat"); each row is a name, the
 * amount beneath it, and a check circle on the right. A checked row dims.
 *
 * 🔑 The list is DERIVED from the current plan revision. The member writes only
 * two things: the checkbox, and lines they add themselves. Everything else
 * follows the plan, which is why there is no edit affordance on a derived row.
 */
export function GroceryListScreen({ navigation }: Props) {
  const [list, setList] = useState<GroceryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GroceryItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (rebuild = false) => {
    try {
      const r = await getGroceryList({ rebuild });
      setList(r.items);
      setError(null);
    } catch (e: any) {
      // The server refuses when there is no plan for the week rather than
      // generating one. Say that plainly instead of showing an empty list,
      // which would read as "you need nothing this week".
      setError(e?.message ?? "Could not load your list.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Pull to refresh REBUILDS rather than re-reads.
   *
   * A plain read returns the stored list, so it would show exactly what is
   * already on screen and look broken. Rebuilding is the point: it re-derives
   * from the current plan, which is how a member picks up a corrected quantity
   * without waiting for the week to roll over. Check state survives it —
   * `derive()` carries ticks across by ingredient, and manual lines are not
   * touched at all.
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  /**
   * Tick a line optimistically.
   *
   * The member is standing in a shop; waiting on a round-trip before the box
   * fills would feel broken. On failure the box goes back rather than silently
   * disagreeing with the server.
   */
  const toggle = useCallback(async (item: GroceryItem) => {
    const next = !item.checked;
    setList((prev) =>
      prev?.map((i) => (i.id === item.id ? { ...i, checked: next } : i)) ?? prev,
    );
    try {
      await setGroceryItemChecked(item.id, next);
    } catch {
      setList((prev) =>
        prev?.map((i) => (i.id === item.id ? { ...i, checked: !next } : i)) ?? prev,
      );
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    const before = list;
    setList((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
    try {
      await removeGroceryItem(item.id);
      // Lang's annotation on this flow. 📌 No Undo here, unlike her Saved
      // Meals toasts — she draws one there and not here, and the confirm
      // dialog already stands between the member and the delete.
      setToast("Removed from Grocery List");
    } catch {
      setList(before ?? null);
      setToast("That didn't go through. Try again.");
    }
  }, [pendingDelete, list]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAdded = useCallback((item: GroceryItem) => {
    setAddOpen(false);
    // Append locally rather than refetching: a refetch of a derived list is a
    // heavier call than this is worth, and the server has already told us
    // exactly what it stored.
    setList((prev) => (prev ? [...prev, item] : [item]));
  }, []);

  const handleShare = async () => {
    if (!list?.length) return;
    const text = [...list]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => {
        const amount = amountLabel(i);
        return `- ${i.name}${amount ? ` (${amount})` : ""}`;
      })
      .join("\n");
    try {
      await Share.share({ message: `Grocery list\n\n${text}` });
    } catch {
      // Cancelled.
    }
  };

  /**
   * 🔴 FLAT, not grouped — and that is a DATA decision, not a design one.
   *
   * Lang's frame groups rows by shelf category ("Produce", "Meat"), and the
   * server now carries `category` for exactly that. But `ingredient.category`
   * in production is not a shelf taxonomy: **418 distinct values across 914
   * ingredients, 245 of them used by a single ingredient**, mixing real aisles
   * ("Produce" 14, "Dairy" 8) with ingredient types ("spices", "cheese",
   * "steak") and junk ("Foods", "Jarred"). The top 15 values cover ~21% of
   * ingredients.
   *
   * Grouping on it produced 94 sections of one row each for a single week —
   * strictly worse than no grouping. Mapping the values onto real aisles would
   * leave ~80% in "Other", which is a flat list with extra ceremony.
   *
   * `groupByCategory` is kept and tested in the service: when the catalogue has
   * a real aisle taxonomy this becomes a one-line switch back.
   */
  const sortedItems = list
    ? [...list].sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const remaining = list?.filter((i) => !i.checked).length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill={K.cream}
            />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Grocery List</Text>
        <View style={styles.headerButtons}>
          <Pressable
            onPress={handleShare}
            hitSlop={8}
            style={styles.roundButton}
            accessibilityRole="button"
            accessibilityLabel="Share list"
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
                fill={K.cream}
              />
            </Svg>
          </Pressable>
          <Pressable
            onPress={() => setAddOpen(true)}
            hitSlop={8}
            style={styles.roundButton}
            accessibilityRole="button"
            accessibilityLabel="Add custom item"
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={K.cream} />
            </Svg>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No list yet</Text>
          <Text style={styles.emptyText}>
            Open My Plan first — your list is built from the week you are planning.
          </Text>
        </View>
      ) : list === null ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={K.ochre} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Nothing to buy</Text>
          <Text style={styles.emptyText}>
            Tap + to add anything the plan does not cover.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={K.cream}
            />
          }
        >
          <Text style={styles.remaining}>
            {remaining} {remaining === 1 ? "item" : "items"} left
          </Text>
          <View style={styles.card}>
            {sortedItems.map((item, idx) => (
              <GroceryRow
                key={item.id}
                item={item}
                first={idx === 0}
                onToggle={() => toggle(item)}
                onDelete={item.manual ? () => setPendingDelete(item) : undefined}
              />
            ))}
          </View>
        </ScrollView>
      )}

      <AddItemSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />

      <DeleteConfirm
        item={pendingDelete}
        onKeep={() => setPendingDelete(null)}
        onDelete={confirmDelete}
      />

      {/* 🔴 NOT a dark pill. This screen's background IS brown, so Lang's dark
          toast would be invisible on it — the same mistake I made once on
          Saved Meals and only caught on the device. */}
      {toast ? (
        <View style={styles.toast} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.toastText} numberOfLines={2}>
            {toast}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function GroceryRow({
  item,
  first,
  onToggle,
  onDelete,
}: {
  item: GroceryItem;
  first: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const amount = amountLabel(item);
  /**
   * GROCERY LIST r5's failure behavior: *"Flag unmapped ingredient; do not
   * silently drop."* The server already decides this — `needsReview` is set
   * when the units could not be reconciled into one number — and we were
   * doing the first half only: the line was carried, never flagged.
   *
   * 📌 Two different failures, two different sentences. A line with an amount
   * has amounts we could not ADD UP ("2 serving + 0.13 tablespoon + 1.04
   * teaspoon"); a line without one has no usable amount at all. Saying
   * "needs review" would be our word for our problem — these say what the
   * member is actually looking at.
   *
   * ✅ Both strings are Bryan's: "Amounts shown separately" 2026-10-20, and
   * "Quantity not provided" 2026-10-21 — he ruled on the no-amount case after
   * I flagged that the placeholder there had been mine, not his.
   */
  const flag = !item.needsReview
    ? null
    : amount
      ? "Amounts shown separately"
      : "Quantity not provided";
  return (
    <Pressable
      onPress={onToggle}
      // 🔑 Long-press rather than swipe. The frame shows a swipe-to-reveal
      // trash, which needs a gesture-handler Swipeable this screen does not
      // have yet; long-press is reachable today and does not pretend a swipe
      // exists that silently does nothing. Only on a member-added line —
      // a derived one has no delete, because r9 removes those with the meal.
      onLongPress={onDelete}
      style={[styles.row, !first && styles.rowDivider, item.checked && styles.rowChecked]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={`${item.name}${amount ? `, ${amount}` : ""}${flag ? `, ${flag}` : ""}`}
      accessibilityHint={onDelete ? "Long press to remove" : undefined}
    >
      <View style={styles.rowText}>
        <Text
          style={[styles.rowName, item.checked && styles.rowNameChecked]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        {amount ? <Text style={styles.rowAmount}>{amount}</Text> : null}
        {flag ? <Text style={styles.rowFlag}>{flag}</Text> : null}
      </View>
      <Checkmark checked={item.checked} />
    </Pressable>
  );
}

/** Empty circle when unchecked, filled with a tick when checked. */
function Checkmark({ checked }: { checked: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={11}
        stroke={checked ? "transparent" : "rgba(243,239,227,0.5)"}
        strokeWidth={1.5}
        fill={checked ? "rgba(243,239,227,0.4)" : "transparent"}
      />
      {checked ? (
        <Path
          d="M9.55 17.1 4.85 12.4l1.4-1.4 3.3 3.3 8.2-8.2 1.4 1.4z"
          fill={K.brown}
        />
      ) : null}
    </Svg>
  );
}

/**
 * Add custom item — Lang's 3 states (`5039:33853`, `5039:28592`, `5039:34169`).
 *
 * 🔑 Only the name enables the button. Category and Quantity stay optional, and
 * Quantity is ONE free text field: the frame shows "2 cloves" and "1 1/2 tsp",
 * which are not a number plus a unit.
 */
function AddItemSheet({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: (item: GroceryItem) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setName("");
    setCategory("");
    setQuantity("");
    setSaving(false);
  }, []);

  /**
   * 🔴 Clear the fields whenever the sheet closes.
   *
   * The sheet is a `Modal` inside a mounted screen, so its state outlives being
   * dismissed — `reset()` used to run only on a SUCCESSFUL submit. Dismissing
   * with the close button, the backdrop or Android back therefore left the
   * typed text sitting there, and the next open showed a half-filled form that
   * the member had already abandoned. Found by dismissing mid-entry and
   * reopening: the second attempt's typing interleaved with the first.
   */
  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const item = await addGroceryItem({
        name: name.trim(),
        category: category.trim() || null,
        quantity: quantity.trim() || null,
      });
      reset();
      onAdded(item);
    } catch {
      setSaving(false);
    }
  };

  const canSubmit = name.trim().length > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {/* 🔴 `behavior` is set on BOTH platforms. It was iOS-only, and on
          Android that meant no avoidance at all: the keyboard sat on top of the
          Add Item button, so a member could type a name and have no way to
          submit it. The accessibility dump still reported the button's bounds,
          which is why it looked fine until I actually tried to tap it. The
          ScrollView is the belt to that braces — on a short screen the button
          stays reachable even with the keyboard up. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetGrabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add custom item</Text>
            <Pressable
              onPress={onClose}
              style={styles.sheetClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill={K.brown}
                />
              </Svg>
            </Pressable>
          </View>

          {/* Her `Line 30` (5039:33968): 0.5 of `#c3b9ba`, 24 below the title
              block and 24 above the first field. We had no rule at all. */}
          <View style={styles.sheetDivider} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetFields}
          >
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Item name"
            placeholderTextColor="#7e6869"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {/* 📌 The frame draws Category as a dropdown. There is no fixed option
              list anywhere in the spec or the data — `ingredient.category` is a
              free text column — so this is a text field until Bryan or Lang
              supplies the list. Typing is better than a picker with invented
              options. */}
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="Category"
            placeholderTextColor="#7e6869"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Quantity"
            placeholderTextColor="#7e6869"
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.addButton, !canSubmit && styles.addButtonDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            <Text style={styles.addButtonText}>
              {saving ? "Adding…" : "Add Item"}
            </Text>
          </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Lang's confirm (`5039:34569`) — keeping the item is the primary action. */
function DeleteConfirm({
  item,
  onKeep,
  onDelete,
}: {
  item: GroceryItem | null;
  onKeep: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onKeep}>
      <Pressable style={styles.backdrop} onPress={onKeep} />
      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.sheetGrabber} />
          <Text style={styles.confirmTitle}>
            Are you sure you want to delete this item?
          </Text>
          <Pressable onPress={onKeep} style={styles.keepButton} accessibilityRole="button">
            <Text style={styles.keepButtonText}>Keep item</Text>
          </Pressable>
          <Pressable onPress={onDelete} style={styles.deleteLink} accessibilityRole="button">
            <Text style={styles.deleteLinkText}>Yes, delete item</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /**
   * Quiet, not alarming: this is a data gap, not something they did wrong.
   *
   * 🔑 NOT italic. DM Sans ships no italic face, so `fontStyle: "italic"`
   * made Android synthesise an oblique while iOS rendered it upright — the
   * same string leaning on one platform and not the other. Bryan ruled
   * upright on both, 2026-10-21.
   */
  rowFlag: {
    marginTop: 2,
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
    color: "rgba(243,239,227,0.55)",
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: K.bone,
  },
  toastText: {
    fontFamily: fonts.catalogue,
    fontSize: 15,
    letterSpacing: -0.15,
    color: K.brown,
  },
  container: { flex: 1, backgroundColor: K.brown },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { flex: 1, fontFamily: fonts.catalogue, fontSize: 24, color: K.cream },
  headerButtons: { flexDirection: "row", gap: 8 },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(243,239,227,0.12)",
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  remaining: {
    fontFamily: fonts.quadrant,
    fontSize: 14,
    color: "rgba(243,239,227,0.7)",
    marginBottom: 16,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.cream,
    marginBottom: 12,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(243,239,227,0.25)",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingLeft: 12,
    paddingRight: 16,
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(243,239,227,0.18)",
  },
  rowChecked: { opacity: 0.5 },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontFamily: fonts.catalogue, fontSize: 16, color: K.cream },
  rowNameChecked: { textDecorationLine: "line-through" },
  rowAmount: {
    fontFamily: fonts.quadrant,
    fontSize: 13,
    color: "rgba(243,239,227,0.65)",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.cream,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: fonts.catalogue,
    fontSize: 15,
    color: "rgba(243,239,227,0.7)",
    textAlign: "center",
  },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "85%",
    backgroundColor: "#F3EFE3",
    // Her sheet is 32 at the top (`5039:33962`), not 24.
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(54,20,22,0.25)",
    marginBottom: 8,
  },
  /**
   * 📏 Her fields sit 72 apart at 48 tall (`5039:33962`: y=118/190/262), so the
   * gap is **24**. We were running 12, which read as a denser form than she
   * drew.
   *
   * ⚠️ THE COST, measured on an S24 (360x780dp): at 24 the form is ~46dp
   * taller, and with the keyboard up — `autoFocus` opens it immediately —
   * "Add Item" now sits BELOW the fold. At 12 it was visible without
   * scrolling. The `ScrollView` is what keeps it reachable (verified: one
   * swipe brings it back, bounds valid, submit works), which is exactly the
   * belt the comment on `behavior` below describes.
   *
   * 🔑 Her frame is 402x843 with no keyboard drawn, so this constraint does
   * not exist in Figma — it only appears on a narrow phone mid-entry. Flagged
   * to Lang rather than silently reverting her spacing: the choice between
   * her rhythm and a visible CTA is hers, not ours.
   */
  sheetFields: { gap: 24, paddingBottom: 8 },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#c3b9ba",
    marginTop: 12,
    marginBottom: 12,
  },
  /**
   * Her close is a **40x40 Rounded Icon button** (`5039:33977`) with a
   * transparent fill — a real 40 target, not a 20 glyph wearing hitSlop. The
   * circle is invisible; the size is the point.
   */
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontFamily: fonts.catalogue, fontSize: 32, color: K.brown },
  /**
   * 🔑 THE SWEPT CORNER IS THE HOUSE SHAPE, and her inputs carry it too:
   * `0 / 0 / 24 / 0` — bottom-right only (`5039:33969`'s inner frame). We had
   * a uniform 10 all round, which is a different language from every other
   * surface on this screen.
   * 📏 48 tall, border 0.5 of `#7e6869` (her `Text (alt)` light), text inset
   * 12 — her `text` frame is 313 inside 337.
   */
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#7e6869",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.brown,
  },
  /** Her primary (`5039:33973`): 56 tall, `4 / 24 / 4 / 4`, solid brown. */
  addButton: {
    marginTop: 11,
    height: 56,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.brown,
  },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: { fontFamily: fonts.catalogueMedium, fontSize: 16, color: K.cream },

  confirmTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    color: K.brown,
    marginBottom: 24,
  },
  /**
   * 🔴 NOT A PILL. Keeping is her primary and it is the same button as
   * "Add Item" — 56 tall, `4 / 24 / 4 / 4`, solid brown
   * (`I5039:34569;4634:58802`). The 999 here was the same mistake the action
   * bar made: **her buttons are XSmall 4 with one swept corner, never round.**
   */
  keepButton: {
    height: 56,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.brown,
  },
  keepButtonText: { fontFamily: fonts.catalogueMedium, fontSize: 16, color: K.cream },
  /**
   * Her secondary (`I5039:34569;4634:58803`) is a REAL button that hugs its
   * label: 32 tall, radius 4, ghost `rgba(54,20,22,0.12)` — not a bare text
   * link, and **not red**.
   *
   * ⚠️ The red was ours. Her hierarchy already does the protecting: "Keep
   * item" is large and solid, this one is small and quiet. Flagged to Lang
   * rather than kept, since a destructive-red link is a semantic choice
   * neither she nor Bryan asked for.
   */
  deleteLink: {
    alignSelf: "center",
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(54,20,22,0.12)",
  },
  deleteLinkText: { fontFamily: fonts.catalogueMedium, fontSize: 14, color: K.brown },
});
