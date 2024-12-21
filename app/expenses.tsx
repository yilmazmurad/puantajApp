import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';

interface Expense {
  id: string;
  description: string;
  amount: number;
  day: string;
}

interface WeekData {
  week: number;
  expenses: Expense[];
}

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function ExpensesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const week = params.week ? parseInt(params.week as string, 10) : 1;

  const [weekData, setWeekData] = React.useState<WeekData>({ week, expenses: [] });
  const [totalAmount, setTotalAmount] = React.useState(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [selectedDay, setSelectedDay] = useState('');

  React.useEffect(() => {
    loadData();
  }, [week]);

  const loadData = async () => {
    try {
      const savedWeekData = await AsyncStorage.getItem(`weekData_${week}`);
      console.log('Yüklenen veri:', savedWeekData); // Debug için log
      
      if (savedWeekData) {
        const data = JSON.parse(savedWeekData);
        setWeekData({
          week: week,
          expenses: data.expenses || []
        });
        
        const total = (data.expenses || []).reduce((sum: number, expense: Expense) => sum + expense.amount, 0);
        setTotalAmount(total);
      } else {
        // Eğer veri yoksa boş bir başlangıç durumu oluştur
        setWeekData({
          week: week,
          expenses: []
        });
        setTotalAmount(0);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir hata oluştu.');
    }
  };

  const saveData = async (updatedData: WeekData) => {
    try {
      await AsyncStorage.setItem(`weekData_${week}`, JSON.stringify(updatedData));
      await loadData(); // Verileri tekrar yükle
    } catch (error) {
      console.error('Veri kaydedilirken hata oluştu:', error);
      Alert.alert('Hata', 'Veriler kaydedilirken bir hata oluştu.');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const updatedExpenses = weekData.expenses.filter((expense) => expense.id !== expenseId);
    const updatedWeekData = { ...weekData, expenses: updatedExpenses };
    await saveData(updatedWeekData);
  };

  const handleAddExpense = async () => {
    try {
      if (!expenseDescription || !expenseAmount || !selectedDay) {
        Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
        return;
      }
    
      const amount = parseFloat(expenseAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Hata', 'Geçerli bir tutar girin.');
        return;
      }
    
      const newExpense: Expense = {
        id: Date.now().toString(),
        description: expenseDescription,
        amount: amount,
        day: selectedDay,
      };
    
      // Mevcut verileri yükle
      const currentData = await AsyncStorage.getItem(`weekData_${week}`);
      let updatedWeekData: WeekData;
      
      if (currentData) {
        const parsedData = JSON.parse(currentData);
        updatedWeekData = {
          week,
          expenses: [...(parsedData.expenses || []), newExpense]
        };
      } else {
        updatedWeekData = {
          week,
          expenses: [newExpense]
        };
      }
      
      // Verileri kaydet
      await AsyncStorage.setItem(`weekData_${week}`, JSON.stringify(updatedWeekData));
      console.log('Kaydedilen veri:', updatedWeekData); // Debug için log
      
      // State'i güncelle
      setWeekData(updatedWeekData);
      setTotalAmount(prevTotal => prevTotal + amount);
      
      setShowExpenseModal(false);
      resetExpenseForm();
      
      // Verileri tekrar yükle
      await loadData();
      
    } catch (error) {
      console.error('Gider ekleme hatası:', error);
      Alert.alert('Hata', 'Gider eklenirken bir hata oluştu.');
    }
  };

  const resetExpenseForm = () => {
    setExpenseDescription('');
    setExpenseAmount('');
    setSelectedDay('');
  };

  const groupExpensesByDay = () => {
    return weekData.expenses.reduce((grouped: { [key: string]: Expense[] }, expense) => {
      if (!grouped[expense.day]) grouped[expense.day] = [];
      grouped[expense.day].push(expense);
      return grouped;
    }, {});
  };

  const clearWeekData = () => {
    Alert.alert(
      "Haftayı Temizle",
      `${week}. haftaya ait tüm giderleri silmek istediğinize emin misiniz?`,
      [
        {
          text: "İptal",
          style: "cancel"
        },
        {
          text: "Temizle",
          onPress: async () => {
            try {
              const updatedWeekData = {
                week,
                expenses: []
              };
              await AsyncStorage.setItem(`weekData_${week}`, JSON.stringify(updatedWeekData));
              setWeekData(updatedWeekData);
              setTotalAmount(0);
            } catch (error) {
              console.error('Temizleme hatası:', error);
              Alert.alert('Hata', 'Veriler temizlenirken bir hata oluştu.');
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };

  return (
    <View style={styles.container}>
      {/* Stack.Screen ile varsayılan header'ı gizle */}
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Giderler</Text>
        </View>
        <TouchableOpacity 
          onPress={clearWeekData}
          style={styles.clearButton}
        >
          <Text style={styles.clearButtonText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addExpenseContainer}>
        <TouchableOpacity 
          onPress={() => setShowExpenseModal(true)}
          style={styles.addExpenseButton}
        >
          <Text style={styles.addExpenseButtonText}>+ Yeni Gider Ekle</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showExpenseModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Gider Ekle</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Gider Açıklaması"
              value={expenseDescription}
              onChangeText={setExpenseDescription}
            />

            <TextInput
              style={styles.input}
              placeholder="Tutar"
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              keyboardType="numeric"
            />

            <ScrollView horizontal style={styles.daySelector}>
              {DAYS.map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayItem,
                    selectedDay === day && styles.selectedDay
                  ]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[
                    styles.dayText,
                    selectedDay === day && styles.selectedDayText
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                onPress={() => {
                  setShowExpenseModal(false);
                  resetExpenseForm();
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.buttonText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleAddExpense}
                style={[styles.modalButton, styles.saveButton]}
              >
                <Text style={styles.buttonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Toplam Tutar:</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
      </View>

      <ScrollView style={styles.content}>
        {Object.entries(groupExpensesByDay()).map(([day, expenses]) => (
          <View key={day} style={styles.dayGroup}>
            <Text style={styles.dayTitle}>{day}</Text>
            {expenses.map(expense => (
              <View key={expense.id} style={styles.expenseItem}>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDescription}>{expense.description}</Text>
                  <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => handleDeleteExpense(expense.id)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>Sil</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 22,
    color: '#666',
    lineHeight: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  totalContainer: {
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  content: {
    flex: 1,
  },
  dayGroup: {
    backgroundColor: '#fff',
    marginBottom: 8,
    padding: 16,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    marginBottom: 4,
  },
  expenseAmount: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 200,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginVertical: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  daySelector: {
    marginVertical: 10,
  },
  dayItem: {
    padding: 10,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    minWidth: 100,
  },
  selectedDay: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  dayText: {
    textAlign: 'center',
    fontSize: 14,
  },
  selectedDayText: {
    color: 'white',
  },
  weekTabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    padding: 10,
  },
  weekTabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  weekTab: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeWeekTab: {
    backgroundColor: '#4CAF50',
  },
  weekTabText: {
    color: '#666',
  },
  activeWeekTabText: {
    color: '#fff',
  },
  versionContainer: {
    position: 'absolute',
    right: 0,
    top: 5,
  },
  overtimeContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  overtimeX: {
    position: 'absolute',
  },
  overtimePlus: {
    position: 'absolute',
    fontSize: 14,
    top: -2,
    right: -2,
  },
  overtimeSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 10,
    marginVertical: 10,
  },
  overtimeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  overtimeLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  overtimeInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    width: 80,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  addExpenseContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addExpenseButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addExpenseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
