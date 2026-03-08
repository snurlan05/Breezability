#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SparkFun_APDS9960.h>

Servo Window;
int position = 0;
int tempPin = A0;
SparkFun_APDS9960 apds = SparkFun_APDS9960();
uint16_t light_level = 0;
LiquidCrystal_I2C lcd(0x27, 16, 2);
float x = 0;

void setup() {

  Window.attach(3);
  Serial.begin(9600);
  Window.write(0);
  analogRead(tempPin);
  lcd.init();
  lcd.backlight();
  apds.init();
  apds.enableLightSensor();

  delay(5000);

  for(int j = 0; j < 5; j++) {
    analogRead(tempPin);
    delay(50);
  }

  for(int i = 0; i < 6 ; i++){
    int measure = analogRead(tempPin); 
    float voltage = measure * (4.4 / 1023.0);
    float temp = (voltage - 0.5) * 100;
    if (i > 0){
     x = x + temp; 
    }
    Serial.println(temp);
  delay(1000);
  }
  x = (x/5.0);
  Serial.println(x);

}

void loop() {
  
  int measure = analogRead(tempPin); 
  float voltage = measure * (4.4 / 1023.0);
  float temp = (voltage - 0.5) * 100;
  position = ((temp-x)*100);
  if(position >= 0 && position <= 180){
    Window.write(position); 
  }else if((position <= 0)){
    Window.write(0);
  }else if((position >= 150)){
    Window.write(150);
  }
  
  lcd.setCursor(0, 0);
  lcd.print("Temperature: ");
  lcd.setCursor(0, 1);
  lcd.print(temp);             
  Serial.print("Temperature: ");
  Serial.print(temp);
  Serial.println("°C");
  apds.readAmbientLight(light_level);
  Serial.println(light_level);
  
  delay(1000);
}