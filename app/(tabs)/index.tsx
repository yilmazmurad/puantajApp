import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Person {
  id: number;
  name: string;
  schedule: {
    [key: string]: 'none' | 'half' | 'full';
  };
}

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function TabOneScreen() {
  const [people, setPeople] = useState<Person[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);

  useEffect(() => {
    async function enableRotation() {
      await ScreenOrientation.unlockAsync();
    }
    enableRotation();

    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
      setScreenHeight(window.height);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData();
  }, [people]);

  const isLandscape = screenWidth > screenHeight;

  const calculateDimensions = () => {
    const availableWidth = screenWidth - 20; // Padding için 20 çıkarıyoruz
    const minCellWidth = 40; // Minimum hücre genişliği
    const nameColumnWidth = Math.max(availableWidth * 0.25, 80); // İsim sütunu için minimum 80px
    const remainingWidth = availableWidth - nameColumnWidth;
    const daysColumnWidth = Math.max(remainingWidth / 8, minCellWidth); // 7 gün + 1 toplam sütunu

    return {
      cellWidth: daysColumnWidth,
      nameCellWidth: nameColumnWidth
    };
  };

  const { cellWidth, nameCellWidth } = calculateDimensions();

  const addPerson = async () => {
    if (newPersonName.trim()) {
      const newPerson: Person = {
        id: Date.now(),
        name: newPersonName.trim(),
        schedule: {}
      };
      setPeople([...people, newPerson]);
      setNewPersonName('');
      setModalVisible(false);
    }
  };

  const toggleAttendance = (personId: number, day: string) => {
    setPeople(people.map(person => {
      if (person.id === personId) {
        const key = `${currentWeek}-${day}`;
        const currentStatus = person.schedule[key] || 'none';
        
        let newStatus: 'none' | 'half' | 'full';
        if (currentStatus === 'none') newStatus = 'half';
        else if (currentStatus === 'half') newStatus = 'full';
        else newStatus = 'none';
        
        return {
          ...person,
          schedule: {
            ...person.schedule,
            [key]: newStatus
          }
        };
      }
      return person;
    }));
  };

  const handleLongPress = (person: Person) => {
    Alert.alert(
      "Çalışan Sil",
      `${person.name} isimli çalışanı silmek istediğinize emin misiniz?`,
      [
        {
          text: "İptal",
          style: "cancel"
        },
        {
          text: "Sil",
          onPress: async () => {
            const updatedPeople = people.filter(p => p.id !== person.id);
            setPeople(updatedPeople);
          },
          style: "destructive"
        }
      ]
    );
  };

  const clearCurrentWeekChecks = () => {
    Alert.alert(
      "Haftalık İşaretlemeleri Sil",
      `${currentWeek}. haftaya ait tüm işaretlemeleri silmek istediğinize emin misiniz?`,
      [
        {
          text: "İptal",
          style: "cancel"
        },
        {
          text: "Sil",
          onPress: async () => {
            const updatedPeople = people.map(person => ({
              ...person,
              schedule: Object.fromEntries(
                Object.entries(person.schedule).filter(([key]) => !key.startsWith(`${currentWeek}-`))
              )
            }));
            setPeople(updatedPeople);
          },
          style: "destructive"
        }
      ]
    );
  };

  const loadData = async () => {
    try {
      const savedPeople = await AsyncStorage.getItem('people');
      if (savedPeople) {
        setPeople(JSON.parse(savedPeople));
      }
    } catch (error) {
      Alert.alert(
        "Hata",
        "Veriler yüklenirken bir hata oluştu."
      );
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('people', JSON.stringify(people));
    } catch (error) {
      Alert.alert(
        "Hata",
        "Veriler kaydedilirken bir hata oluştu."
      );
    }
  };

  const calculateWorkDays = (schedule: Person['schedule'], week: number) => {
    return Object.entries(schedule)
      .filter(([key]) => key.startsWith(`${week}-`))
      .reduce((total, [_, value]) => {
        if (value === 'full') return total + 1;
        if (value === 'half') return total + 0.5;
        return total;
      }, 0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>{currentWeek}. Hafta Puantaj</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Yeni Çalışan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearCurrentWeekChecks} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>İşaretlemeleri Sil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.tableContainer}>
        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, styles.headerCell, { width: nameCellWidth }]}>
              <Text style={styles.headerText}>Çalışan</Text>
            </View>
            {DAYS.map(day => (
              <View key={day} style={[styles.cell, styles.headerCell, { width: cellWidth }]}>
                <Text style={styles.headerText}>{isLandscape ? day : day.slice(0, 3)}</Text>
              </View>
            ))}
            <View style={[styles.cell, styles.headerCell, { width: cellWidth }]}>
              <Text style={styles.headerText}>Toplam</Text>
            </View>
          </View>

          {people.map(person => (
            <View key={person.id} style={styles.row}>
              <TouchableOpacity 
                onLongPress={() => handleLongPress(person)}
                style={[styles.cell, styles.nameCell, { width: nameCellWidth }]}>
                <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">{person.name}</Text>
              </TouchableOpacity>
              {DAYS.map(day => (
                <TouchableOpacity 
                  key={day} 
                  style={[
                    styles.cell, 
                    styles.dayCell,
                    { width: cellWidth },
                    person.schedule[`${currentWeek}-${day}`] === 'half' && styles.halfDayCell,
                    person.schedule[`${currentWeek}-${day}`] === 'full' && styles.fullDayCell
                  ]}
                  onPress={() => toggleAttendance(person.id, day)}>
                  {person.schedule[`${currentWeek}-${day}`] === 'half' && (
                    <View style={styles.halfDayContainer}>
                      <Text style={styles.halfDayText}>/</Text>
                    </View>
                  )}
                  {person.schedule[`${currentWeek}-${day}`] === 'full' && (
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmark}>X</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <View style={[styles.cell, styles.totalCell, { width: cellWidth }]}>
                <Text style={styles.totalText}>
                  {calculateWorkDays(person.schedule, currentWeek)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.weekTabBar}>
        {[1, 2, 3, 4].map((week) => (
          <TouchableOpacity
            key={week}
            style={[
              styles.weekTab,
              currentWeek === week && styles.activeWeekTab
            ]}
            onPress={() => setCurrentWeek(week)}>
            <Text style={[
              styles.weekTabText,
              currentWeek === week && styles.activeWeekTabText
            ]}>
              {week}. Hafta
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Çalışan Ekle</Text>
            <TextInput
              style={styles.input}
              onChangeText={setNewPersonName}
              value={newPersonName}
              placeholder="Çalışan Adı"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setNewPersonName('');
                }}>
                <Text style={styles.modalButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addPerson}>
                <Text style={styles.modalButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  header: {
    padding: 10,
  },
  headerTop: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  clearButton: {
    backgroundColor: '#f44336',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginLeft: 5,
  },
  addButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  clearButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  tableContainer: {
    flex: 1,
  },
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ddd',
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  headerCell: {
    backgroundColor: '#f5f5f5',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  nameCell: {
    backgroundColor: '#f9f9f9',
  },
  nameText: {
    fontSize: 12,
  },
  dayCell: {
    backgroundColor: '#fff',
  },
  halfDayCell: {
    backgroundColor: '#fff3e0',
  },
  fullDayCell: {
    backgroundColor: '#e8f5e9',
  },
  totalCell: {
    backgroundColor: '#f5f5f5',
  },
  totalText: {
    fontWeight: 'bold',
  },
  halfDayText: {
    fontSize: 20,
    color: '#ff9800',
  },
  checkmark: {
    fontSize: 16,
    color: '#4CAF50',
  },
  halfDayContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  weekTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  weekTab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 5,
    marginHorizontal: 2,
  },
  activeWeekTab: {
    backgroundColor: '#4CAF50',
  },
  weekTabText: {
    color: '#666',
    fontWeight: 'bold',
  },
  activeWeekTabText: {
    color: '#fff',
  },
});
