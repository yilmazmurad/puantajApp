import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, Platform, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import { useRef, useEffect } from 'react';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Person {
  id: number;
  name: string;
  schedule: {
    [key: string]: {
      status?: 'full' | 'half';
      overtime?: boolean;
      overtimeValue?: number;
    };
  };
}

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

export default function SummaryScreen() {
  const { week, peopleData } = useLocalSearchParams();
  const people = JSON.parse(decodeURIComponent(peopleData as string)) as Person[];
  const currentWeek = parseInt(week as string);
  const router = useRouter();
  const summaryRef = useRef<View>(null);

  const [weekData, setWeekData] = useState<WeekData>({ week: currentWeek, expenses: [] });
  const [totalExpenseAmount, setTotalExpenseAmount] = useState(0);

  useEffect(() => {
    loadExpenseData();
  }, [currentWeek]);

  const loadExpenseData = async () => {
    try {
      const savedWeekData = await AsyncStorage.getItem(`weekData_${currentWeek}`);
      if (savedWeekData) {
        const data = JSON.parse(savedWeekData);
        setWeekData(data);
        const total = data.expenses.reduce((sum: number, expense: Expense) => sum + expense.amount, 0);
        setTotalExpenseAmount(total);
      }
    } catch (error) {
      console.error('Gider verisi yükleme hatası:', error);
    }
  };

  const calculateDayDetails = (person: Person, day: string) => {
    const dayKey = `${currentWeek}-${day}`;
    const dayData = person.schedule[dayKey];
    return {
      status: dayData?.status || 'none',
      overtime: dayData?.overtime || false,
      overtimeValue: dayData?.overtimeValue || 0
    };
  };

  const renderWeekTotal = (person: Person, week: number) => {
    let weekTotal = 0;
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

  const handleShare = async () => {
    if (!summaryRef.current) {
      console.error('View reference not found');
      return;
    }

    try {
      // Önce bir kısa bekleme ekleyelim
      await new Promise(resolve => setTimeout(resolve, 100));

      const uri = await captureRef(summaryRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile'
      });
      
      await Share.share({
        url: uri,
      });
    } catch (error) {
      console.error('Paylaşım hatası:', error);
      Alert.alert('Hata', 'Ekran görüntüsü alınırken bir hata oluştu.');
    }
  };

  const createPDF = async () => {
    try {
      let htmlContent = `
        <html>
          <head>
            <style>
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th, td { border: 1px solid #dee2e6; padding: 8px; text-align: center; }
              th { background-color: #f8f9fa; }
              .name-cell { text-align: left; }
              .total-cell { background-color: #e9ecef; }
              .overtime { color: #ff6b00; font-size: 10px; }
              .section-title { font-size: 18px; margin: 20px 0 10px 0; }
              .expense-table { margin-top: 30px; }
              .expense-total { color: #28a745; font-weight: bold; }
            </style>
          </head>
          <body>
            <h2>${currentWeek}. Hafta Puantaj Özeti</h2>
            
            <!-- Personel Puantaj Tablosu -->
            <div class="section-title">Personel Puantaj Özeti</div>
            <table>
              <tr>
                <th class="name-cell">İsim</th>
                ${DAYS.map(day => `<th>${day}</th>`).join('')}
                <th>Toplam</th>
              </tr>
              ${people.map(person => {
                const weekTotal = renderWeekTotal(person, currentWeek);
                return `
                  <tr>
                    <td class="name-cell">${person.name}</td>
                    ${DAYS.map(day => {
                      const dayDetails = calculateDayDetails(person, day);
                      return `<td>
                        ${dayDetails.status === 'full' ? '1' : 
                          dayDetails.status === 'half' ? '0.5' : '-'}
                        ${dayDetails.overtime ? 
                          `<span class="overtime">+${dayDetails.overtimeValue}</span>` : ''}
                      </td>`;
                    }).join('')}
                    <td class="total-cell">${weekTotal.toFixed(1)}</td>
                  </tr>
                `;
              }).join('')}
            </table>

            <!-- Giderler Tablosu -->
            <div class="section-title">Giderler Özeti</div>
            <table class="expense-table">
              <tr>
                <th>Açıklama</th>
                <th>Gün</th>
                <th>Tutar</th>
              </tr>
              ${weekData.expenses.map(expense => `
                <tr>
                  <td>${expense.description}</td>
                  <td>${expense.day}</td>
                  <td>${expense.amount.toFixed(2)} ₺</td>
                </tr>
              `).join('')}
              <tr>
                <td colspan="2" class="total-cell">Toplam Gider</td>
                <td class="total-cell expense-total">${totalExpenseAmount.toFixed(2)} ₺</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      // PDF oluştur
      const file = await RNHTMLtoPDF.convert({
        html: htmlContent,
        fileName: `Puantaj_Hafta_${currentWeek}`,
        width: 842,
        height: 595,
      });

      // PDF'i paylaş
      if (file.filePath) {
        await Share.share({
          url: `file://${file.filePath}`,
          title: `Puantaj Hafta ${currentWeek}`,
          message: `${currentWeek}. Hafta Puantaj Özeti`
        });
      }
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      Alert.alert('Hata', 'PDF oluşturulurken bir hata oluştu.');
    }
  };

  const savePDF = async () => {
    try {
      let htmlContent = `
        <html>
          <head>
            <style>
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th, td { border: 1px solid #dee2e6; padding: 8px; text-align: center; }
              th { background-color: #f8f9fa; }
              .name-cell { text-align: left; }
              .total-cell { background-color: #e9ecef; }
              .overtime { color: #ff6b00; font-size: 10px; }
              .section-title { font-size: 18px; margin: 20px 0 10px 0; }
              .expense-table { margin-top: 30px; }
              .expense-total { color: #28a745; font-weight: bold; }
            </style>
          </head>
          <body>
            <h2>${currentWeek}. Hafta Puantaj Özeti</h2>
            
            <!-- Personel Puantaj Tablosu -->
            <div class="section-title">Personel Puantaj Özeti</div>
            <table>
              <tr>
                <th class="name-cell">İsim</th>
                ${DAYS.map(day => `<th>${day}</th>`).join('')}
                <th>Toplam</th>
              </tr>
              ${people.map(person => {
                const weekTotal = renderWeekTotal(person, currentWeek);
                return `
                  <tr>
                    <td class="name-cell">${person.name}</td>
                    ${DAYS.map(day => {
                      const dayDetails = calculateDayDetails(person, day);
                      return `<td>
                        ${dayDetails.status === 'full' ? '1' : 
                          dayDetails.status === 'half' ? '0.5' : '-'}
                        ${dayDetails.overtime ? 
                          `<span class="overtime">+${dayDetails.overtimeValue}</span>` : ''}
                      </td>`;
                    }).join('')}
                    <td class="total-cell">${weekTotal.toFixed(1)}</td>
                  </tr>
                `;
              }).join('')}
            </table>

            <!-- Giderler Tablosu -->
            <div class="section-title">Giderler Özeti</div>
            <table class="expense-table">
              <tr>
                <th>Açıklama</th>
                <th>Gün</th>
                <th>Tutar</th>
              </tr>
              ${weekData.expenses.map(expense => `
                <tr>
                  <td>${expense.description}</td>
                  <td>${expense.day}</td>
                  <td>${expense.amount.toFixed(2)} ₺</td>
                </tr>
              `).join('')}
              <tr>
                <td colspan="2" class="total-cell">Toplam Gider</td>
                <td class="total-cell expense-total">${totalExpenseAmount.toFixed(2)} ₺</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      // PDF oluştur
      const file = await RNHTMLtoPDF.convert({
        html: htmlContent,
        fileName: `Puantaj_Hafta_${currentWeek}`,
        width: 842,
        height: 595,
      });

      if (file.filePath) {
        // Hedef dizini belirle
        const downloadPath = Platform.select({
          ios: `${RNFS.DocumentDirectoryPath}/Puantaj_Hafta_${currentWeek}.pdf`,
          android: `${RNFS.DownloadDirectoryPath}/Puantaj_Hafta_${currentWeek}.pdf`,
        });

        if (!downloadPath) {
          throw new Error('Platform desteklenmiyor');
        }

        // Dosyayı kopyala
        await RNFS.copyFile(file.filePath, downloadPath);

        Alert.alert(
          'Başarılı',
          Platform.OS === 'ios' 
            ? 'PDF dosyası Belgeler klasörüne kaydedildi.'
            : 'PDF dosyası İndirilenler klasörüne kaydedildi.'
        );
      }
    } catch (error) {
      console.error('PDF kaydetme hatası:', error);
      Alert.alert('Hata', 'PDF kaydedilirken bir hata oluştu.');
    }
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
          <Text style={styles.title}>{currentWeek}. Hafta Özeti</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={createPDF} 
            style={[styles.actionButton, { backgroundColor: '#28a745', marginRight: 8 }]}
          >
            <Text style={styles.actionButtonText}>Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={savePDF} 
            style={[styles.actionButton, { backgroundColor: '#007bff' }]}
          >
            <Text style={styles.actionButtonText}>Kaydet</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView>
        {/* Personel Puantaj Tablosu */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Personel Puantaj Özeti</Text>
          <ScrollView horizontal>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <View style={styles.tableCell}>
                  <Text style={styles.tableHeaderText}>İsim</Text>
                </View>
                {DAYS.map(day => (
                  <View key={day} style={styles.tableCell}>
                    <Text style={styles.tableHeaderText}>{day}</Text>
                  </View>
                ))}
                <View style={[styles.tableCell, styles.totalCell]}>
                  <Text style={styles.tableHeaderText}>Toplam</Text>
                </View>
              </View>

              {people.map((person: Person) => {
                const weekTotal = renderWeekTotal(person, currentWeek);
                return (
                  <View key={person.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.nameCell]}>
                      <Text style={styles.tableCellText}>{person.name}</Text>
                    </View>
                    {DAYS.map(day => {
                      const dayDetails = calculateDayDetails(person, day);
                      return (
                        <View key={day} style={styles.tableCell}>
                          <Text style={styles.tableCellText}>
                            {dayDetails.status === 'full' ? '1' : 
                             dayDetails.status === 'half' ? '0.5' : '-'}
                          </Text>
                          {dayDetails.overtime && (
                            <Text style={styles.overtimeText}>
                              +{dayDetails.overtimeValue}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                    <View style={[styles.tableCell, styles.totalCell]}>
                      <Text style={styles.totalText}>{weekTotal.toFixed(1)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Giderler Tablosu */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Giderler Özeti</Text>
          <ScrollView horizontal>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <View style={[styles.tableCell, { flex: 2 }]}>
                  <Text style={styles.tableHeaderText}>Açıklama</Text>
                </View>
                <View style={styles.tableCell}>
                  <Text style={styles.tableHeaderText}>Gün</Text>
                </View>
                <View style={[styles.tableCell, styles.totalCell]}>
                  <Text style={styles.tableHeaderText}>Tutar</Text>
                </View>
              </View>

              {weekData.expenses.map((expense) => (
                <View key={expense.id} style={styles.tableRow}>
                  <View style={[styles.tableCell, { flex: 2 }]}>
                    <Text style={styles.tableCellText}>{expense.description}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={styles.tableCellText}>{expense.day}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.totalCell]}>
                    <Text style={styles.tableCellText}>{expense.amount.toFixed(2)} ₺</Text>
                  </View>
                </View>
              ))}
              
              <View style={[styles.tableRow, styles.totalRow]}>
                <View style={[styles.tableCell, { flex: 2 }]}>
                  <Text style={styles.totalText}>Toplam Gider</Text>
                </View>
                <View style={styles.tableCell} />
                <View style={[styles.tableCell, styles.totalCell]}>
                  <Text style={[styles.totalText, { color: '#28a745' }]}>
                    {totalExpenseAmount.toFixed(2)} ₺
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
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
  actionButton: {
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
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionContainer: {
    margin: 10,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  tableCell: {
    padding: 12,
    minWidth: 80,
    justifyContent: 'center',
  },
  nameCell: {
    minWidth: 120,
    backgroundColor: '#f8f9fa',
  },
  totalCell: {
    backgroundColor: '#f8f9fa',
    minWidth: 100,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#495057',
  },
  tableCellText: {
    fontSize: 14,
    color: '#212529',
  },
  totalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
  },
  overtimeText: {
    fontSize: 12,
    color: '#ff6b00',
    fontWeight: 'bold',
  },
  totalRow: {
    backgroundColor: '#f8f9fa',
    borderTopWidth: 2,
    borderTopColor: '#dee2e6',
  },
});


