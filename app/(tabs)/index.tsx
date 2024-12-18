import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { CurrentRenderContext } from '@react-navigation/native';

interface Person {
  id: number;
  name: string;
  schedule: {
    [key: string]: {
      status?: 'full' | 'half' | 'none';
      overtime?: boolean;
      overtimeValue?: number;
    };
  };
  weeklyTotals: {
    [week: number]: number;
  };
  total: number;
}

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const SHORT_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'];

export default function TabOneScreen() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const [selectedCell, setSelectedCell] = useState<{personId: number, day: string} | null>(null);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [overtimeValue, setOvertimeValue] = useState('1.0');

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

  const calculateDimensions = () => {
    const availableWidth = screenWidth - 16; // Kenar boşluklarını azalttık
    const isLandscape = screenWidth > screenHeight;
    
    // Dikey modda daha kompakt görünüm
    const minCellWidth = isLandscape ? 40 : 35;
    const nameColumnWidth = isLandscape 
      ? Math.max(availableWidth * 0.2, 100)
      : Math.max(availableWidth * 0.25, 80);
    
    const remainingWidth = availableWidth - nameColumnWidth;
    const daysColumnWidth = Math.max(remainingWidth / 8, minCellWidth);

    return {
      cellWidth: daysColumnWidth,
      nameCellWidth: nameColumnWidth,
      isLandscape
    };
  };

  const { cellWidth, nameCellWidth, isLandscape } = calculateDimensions();

  const addPerson = async () => {
    if (newPersonName.trim()) {
      const newPerson: Person = {
        id: Date.now(),
        name: newPersonName.trim(),
        schedule: {},
        weeklyTotals: {},
        total: 0
      };
      setPeople([...people, newPerson]);
      setNewPersonName('');
      setModalVisible(false);
    }
  };

  const handleCellPress = (personId: number, day: string) => {
    setPeople(prevPeople => {
      return prevPeople.map(person => {
        if (person.id === personId) {
          const currentStatus = person.schedule[`${currentWeek}-${day}`]?.status || 'none';
          let newStatus: 'none' | 'half' | 'full' = 'none';
          let overtime = false;

          if (currentStatus === 'none') {
            newStatus = 'half';
          } else if (currentStatus === 'half') {
            newStatus = 'full';
          } else if (currentStatus === 'full') {
            newStatus = 'none';
          }

          const newSchedule = {
            ...person.schedule,
            [`${currentWeek}-${day}`]: { status: newStatus, overtime }
          };

          return {
            ...person,
            schedule: newSchedule
          };
        }
        return person;
      });
    });
  };

  const handleLongPress = (personId: number, day: string) => {
    setSelectedCell({ personId, day });
    setAttendanceModalVisible(true);
  };

  const handleAttendanceSelect = (type: 'none' | 'half' | 'full', overtime: boolean = false) => {
    if (selectedCell) {
      setPeople(prevPeople => {
        return prevPeople.map(person => {
          if (person.id === selectedCell.personId) {
            const newSchedule = {
              ...person.schedule,
              [`${currentWeek}-${selectedCell.day}`]: { 
                status: type,
                overtime,
                ...(overtime ? { overtimeValue: parseFloat(overtimeValue) } : {})
              }
            };

            return {
              ...person,
              schedule: newSchedule
            };
          }
          return person;
        });
      });
    }
    setAttendanceModalVisible(false);
    setSelectedCell(null);
    setOvertimeValue('1.0'); // Reset overtime value
  };

  const calculateTotal = (schedule: Person['schedule']): number => {
    // Schedule'dan benzersiz hafta numaralarını bul
    const weeks = [...new Set(
      Object.keys(schedule).map(key => parseInt(key.split('-')[0]))
    )];
    
    // Her hafta için toplam hesapla ve topla
    return weeks.reduce((total, week) => {
      return total + calculateWeekTotal(schedule, week);
    }, 0);
  };

  const calculateWeekTotal = (schedule: Person['schedule'], week: number): number => {
    let weekTotal = 0;
    
    // Sadece belirtilen haftanın günlerini kontrol et
    DAYS.forEach(day => {
      const dayKey = `${week}-${day}`;
      const dayData = schedule[dayKey];
      
      if (dayData) {
        if (dayData.status === 'full') {
          weekTotal += 1;
          if (dayData.overtime && dayData.overtimeValue) {
            weekTotal += dayData.overtimeValue;
          }
        } else if (dayData.status === 'half') {
          weekTotal += 0.5;
        }
      }
    });
    
    return weekTotal;
  };

  const renderWeekTotal = (person: Person, week: number) => {
    let weekTotal = 0;
    
    // Sadece belirtilen haftanın günlerini kontrol et
    DAYS.forEach(day => {
      const dayKey = `${week}-${day}`;
      const dayData = person.schedule[dayKey];
      
      if (dayData) {
        if (dayData.status === 'full') {
          weekTotal += 1;
          if (dayData.overtime && dayData.overtimeValue) {
            weekTotal += dayData.overtimeValue;
          }
        } else if (dayData.status === 'half') {
          weekTotal += 0.5;
        }
      }
    });
    
    return weekTotal;
  };

  const getCellStyle = (status: 'none' | 'half' | 'full', overtime: boolean) => {
    const baseStyle = {
      ...styles.cell,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    };

    switch (status) {
      case 'half':
        return {
          ...baseStyle,
          backgroundColor: '#FFF9C4',
        };
      case 'full':
        return {
          ...baseStyle,
          backgroundColor: overtime ? '#FFE0B2' : '#C8E6C9',
        };
      default:
        return baseStyle;
    }
  };

  const renderCell = (person: Person, day: string, cellWidth: number) => {
    const cellData = person.schedule[`${currentWeek}-${day}`] || { status: 'none', overtime: false };
    return (
      <TouchableOpacity
        key={`${person.id}-${day}`}
        style={[
          getCellStyle(cellData.status ?? "none", cellData.overtime ?? false),
          { width: cellWidth }
        ]}
        onPress={() => handleCellPress(person.id, day)}
        onLongPress={() => handleLongPress(person.id, day)}
        delayLongPress={500}
      >
        {cellData.status === 'half' && (
          <Text style={styles.cellText}>/</Text>
        )}
        {cellData.status === 'full' && !cellData.overtime && (
          <Text style={styles.cellText}>X</Text>
        )}
        {cellData.overtime && cellData.status === 'full' && (
          <View style={styles.overtimeContainer}>
            <Text style={[styles.cellText, styles.overtimeX]}>X</Text>
            <Text style={[styles.cellText, styles.overtimePlus]}>+</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const clearCurrentWeekData = () => {
    Alert.alert(
      "Bu Haftayı Temizle",
      `${currentWeek}. haftanın tüm verilerini silmek istediğinize emin misiniz?`,
      [
        {
          text: "İptal",
          style: "cancel"
        },
        {
          text: "Temizle",
          onPress: () => {
            setPeople(prevPeople => {
              return prevPeople.map(person => {
                // Kişinin schedule'ından sadece mevcut haftaya ait kayıtları temizle
                const newSchedule = { ...person.schedule };
                Object.keys(newSchedule).forEach(key => {
                  if (key.startsWith(`${currentWeek}-`)) {
                    delete newSchedule[key];
                  }
                });

                return {
                  ...person,
                  schedule: newSchedule
                };
              });
            });
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

  const calculateWeekSummary = (person: Person, week: number) => {
    let summary = {
      fullDays: 0,
      halfDays: 0,
      overtimeHours: 0,
      totalDays: 0
    };

    DAYS.forEach(day => {
      const dayKey = `${week}-${day}`;
      const dayData = person.schedule[dayKey];
      
      if (dayData) {
        if (dayData.status === 'full') {
          summary.fullDays += 1;
          if (dayData.overtime && dayData.overtimeValue) {
            summary.overtimeHours += dayData.overtimeValue;
          }
        } else if (dayData.status === 'half') {
          summary.halfDays += 1;
        }
      }
    });

    summary.totalDays = summary.fullDays + (summary.halfDays * 0.5);
    return summary;
  };

  const handleShowSummary = () => {
    // people verisini URL-safe bir string'e çevir
    const peopleData = encodeURIComponent(JSON.stringify(people));
    router.push({
      pathname: '/summary',
      params: {
        week: currentWeek,
        peopleData: peopleData
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Hafta {currentWeek}</Text>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={() => setModalVisible(true)} 
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          >
            <Text style={styles.actionButtonText}>+ Yeni Çalışan</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: '/expenses',
              params: { week: currentWeek }
            })} 
            style={[styles.actionButton, { backgroundColor: '#007bff' }]}
          >
            <Text style={styles.actionButtonText}>Giderler</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={clearCurrentWeekData} 
            style={[styles.actionButton, { backgroundColor: '#dc3545' }]}
          >
            <Text style={styles.actionButtonText}>Temizle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleShowSummary} 
            style={[styles.actionButton, { backgroundColor: '#17a2b8' }]}
          >
            <Text style={styles.actionButtonText}>Hafta Özeti</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tableContainer}>
        <ScrollView horizontal>
          <View>
            <View style={styles.headerRow}>
              <View style={[styles.cell, styles.nameHeader, { width: nameCellWidth }]}>
                <Text style={styles.headerText}>İsim</Text>
              </View>
              {DAYS.map((day, index) => (
                <View key={day} style={[styles.cell, styles.dayHeader, { width: cellWidth }]}>
                  <Text style={styles.headerText}>
                    {isLandscape ? day.slice(0, 3) : SHORT_DAYS[index]}
                  </Text>
                </View>
              ))}
              <View style={[styles.cell, styles.totalHeader, { width: cellWidth }]}>
                <Text style={styles.headerText}>Top.</Text>
              </View>
            </View>

            <ScrollView style={styles.tableContent}>
              {people.map(person => (
                <View key={person.id} style={styles.row}>
                  <TouchableOpacity
                    style={[styles.cell, styles.nameCell, { width: nameCellWidth }]}
                    onLongPress={() => handleLongPress(person.id, 'none')}
                  >
                    <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">{person.name}</Text>
                  </TouchableOpacity>
                  {DAYS.map(day => (
                    renderCell(person, day, cellWidth)
                  ))}
                  <View style={[styles.cell, styles.totalCell, { width: cellWidth }]}>
                    <Text style={styles.totalText}>
                      {renderWeekTotal(person, currentWeek).toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      <View style={styles.weekTabBar}>
        <View style={styles.weekTabContainer}>
          {Array.from({ length: 4 }, (_, i) => i + 1).map(week => (
            <TouchableOpacity
              key={week}
              style={[styles.weekTab, currentWeek === week && styles.activeWeekTab]}
              onPress={() => setCurrentWeek(week)}
            >
              <Text style={[styles.weekTabText, currentWeek === week && styles.activeWeekTabText]}>
                {week}. Hafta
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={attendanceModalVisible}
        onRequestClose={() => setAttendanceModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setAttendanceModalVisible(false)}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHeader}>
                <View style={styles.bottomSheetIndicator} />
                <Text style={styles.bottomSheetTitle}>Çalışma Durumu</Text>
              </View>
              
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleAttendanceSelect('half')}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.optionIcon, { backgroundColor: '#FFF9C4' }]}>
                    <Text style={styles.optionIconText}>/</Text>
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Yarım Gün</Text>
                    <Text style={styles.optionDescription}>Yarım gün çalışma</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleAttendanceSelect('full')}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.optionIcon, { backgroundColor: '#C8E6C9' }]}>
                    <Text style={styles.optionIconText}>X</Text>
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Tam Gün</Text>
                    <Text style={styles.optionDescription}>Tam gün çalışma</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.overtimeSection}>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => handleAttendanceSelect('full', true)}
                >
                  <View style={styles.optionContent}>
                    <View style={[styles.optionIcon, { backgroundColor: '#FFE0B2' }]}>
                      <View style={styles.overtimeContainer}>
                        <Text style={[styles.optionIconText, styles.overtimeX]}>X</Text>
                        <Text style={[styles.optionIconText, styles.overtimePlus]}>+</Text>
                      </View>
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={styles.optionTitle}>Mesai</Text>
                      <Text style={styles.optionDescription}>Tam gün + mesai</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.overtimeInputContainer}>
                  <Text style={styles.overtimeLabel}>Mesai Katsayısı:</Text>
                  <TextInput
                    style={styles.overtimeInput}
                    value={overtimeValue}
                    onChangeText={setOvertimeValue}
                    keyboardType="numeric"
                    placeholder="1.0"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.optionButton, styles.cancelOption]}
                onPress={() => handleAttendanceSelect('none')}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.optionIcon, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={[styles.optionIconText, { color: '#D32F2F' }]}>×</Text>
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: '#D32F2F' }]}>İptal Et</Text>
                    <Text style={styles.optionDescription}>Kaydı temizle</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 20,
  },
  weekTabBar: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  weekTabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekTab: {
    padding: 10,
    borderRadius: 5,
  },
  activeWeekTab: {
    backgroundColor: '#007bff',
  },
  weekTabText: {
    color: '#666',
  },
  activeWeekTabText: {
    color: '#fff',
  },
  overtimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: 15,
  },
  headerTop: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  versionText: {
    fontSize: 12,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 8, // Butonlar arası boşluk
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
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
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableContainer: {
    flex: 1,
    marginHorizontal: 8, // Kenar boşluklarını azalttık
    marginVertical: 5,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
  },
  tableContent: {
    flexGrow: 0,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  cell: {
    height: 40, // Hücre yüksekliğini azalttık
    borderWidth: 1,
    borderColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameHeader: {
    backgroundColor: '#f8f9fa',
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  dayHeader: {
    backgroundColor: '#f8f9fa',
  },
  totalHeader: {
    backgroundColor: '#f8f9fa',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 12, // Font boyutunu küçülttük
    color: '#495057',
  },
  nameCell: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  nameText: {
    fontSize: 13, // Font boyutunu küçülttük
    color: '#212529',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  totalCell: {
    backgroundColor: '#f8f9fa',
  },
  totalText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#28a745',
  },
  cellText: {
    fontSize: 14, // Font boyutunu küçülttük
    fontWeight: 'bold',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 300,
    paddingBottom: 30,
  },
  bottomSheetContent: {
    padding: 20,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bottomSheetIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#DEDEDE',
    borderRadius: 2,
    marginBottom: 10,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  optionButton: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  cancelOption: {
    marginTop: 10,
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
  overtimeX: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  overtimePlus: {
      fontSize: 14,
      fontWeight: 'bold',
      marginLeft: 2,
    },
    modalButtonText: {
      color: 'white',
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600'
    },
  overtimeSection: {
      marginTop: 10,
      marginBottom: 10,
      padding: 10,
      borderRadius: 8,
      backgroundColor: '#f8f9fa'
    },
    overtimeInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      paddingHorizontal: 10
    },
    overtimeLabel: {
      marginRight: 10,
      fontSize: 14,
      color: '#666'
    },
    overtimeInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 4,
      padding: 5,
      width: 60,
      textAlign: 'center'
    }
  });
