<?php
// ========================================
// SMART CITY GPS INTEGRATION - KONFIGURACIJA
// Dodato: 02.09.2025
// ========================================

// Environment konfiguracija
define('SMARTCITY_ENV', 'LOCAL'); // LOCAL | STAGING | PRODUCTION

// API konfiguracija
switch(SMARTCITY_ENV) {
    case 'LOCAL':
        define('SMARTCITY_API_URL', 'http://localhost:3010/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'test-api-key-2024');
        define('SMARTCITY_DEBUG', true);
        break;
    case 'STAGING':
        define('SMARTCITY_API_URL', 'https://staging.smart-city.rs/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'staging-api-key-2024');
        define('SMARTCITY_DEBUG', true);
        break;
    case 'PRODUCTION':
        define('SMARTCITY_API_URL', 'https://gsp-admin.smart-city.rs/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'production-api-key-2024');
        define('SMARTCITY_DEBUG', false);
        break;
    default:
        define('SMARTCITY_API_URL', '');
        define('SMARTCITY_API_KEY', '');
        define('SMARTCITY_DEBUG', false);
}

define('SMARTCITY_ENABLED', !empty(SMARTCITY_API_URL) && !empty(SMARTCITY_API_KEY));
define('SMARTCITY_BATCH_SIZE', 50);
define('SMARTCITY_BATCH_TIMEOUT', 3);

// Smart City Batch Buffer
global $smartcity_batch_buffer;
$smartcity_batch_buffer = array();

// ========================================
// ORIGINALNI util_teltonika KOD
// ========================================

class util_teltonika{
	public $mysqli_link;
	public $mysqli_link_gps;
	public $dbname;
	public $dbname_gps;
	public $garage_no;
	public $host;
	public $dbhost;
	public $dbhost_gps;
	public $dbusername;
	public $dbusername_gps;
	public $dbpassword;
	public $dbpassword_gps;
	public $vehicle_debug_mode;
	public $io_settings;
	public $io_settings_write;
	public $device_operaters_array=array();
	public $get_device_operaters_time=0;
	public $gb_io_cache=array();
    public $gb_io_current_cache=[];
	public $last_row_array_for_current=array();
	public $removed_rows_count;
	public $speed_limit;
	public $track_speed;
	public $vehicles_with_tables=array();
	public $vehicles_lines=array();
	public $lines=array();
	public $st_ranges=array();
	public $gnos=array();
	
	// Smart City Integration
	public $smartcity_batch_buffer = array();
	public $smartcity_batch_count = 0;
	public $ranges_loaded=0;
	
	function __construct($link,$dbhost,$dbusername,$dbpassword,$link_gps,$dbhost_gps,$dbusername_gps,$dbpassword_gps,$host){
		$this->mysqli_link=$link;
		$this->mysqli_link_gps=$link_gps;
		$this->dbname='';
		$this->dbname_gps='';
		$this->host=$host;
		$this->dbhost=$dbhost;
		$this->dbhost_gps=$dbhost_gps;
		$this->dbusername=$dbusername;
		$this->dbusername_gps=$dbusername_gps;
		$this->dbpassword=$dbpassword;
		$this->dbpassword_gps=$dbpassword_gps;
		$this->vehicle_debug_mode= array();
	}
	
	public function checkMYSQL(){
		if (mysqli_ping($this->mysqli_link)){
			if (mysqli_ping($this->mysqli_link_gps)){
				return;
			}
			$this->mysqli_link_gps=mysqli_connect($this->dbhost_gps,$this->dbusername_gps,$this->dbpassword_gps) or die("<b>Could not connect:</b>".mysqli_error($this->mysqli_link_gps));
			mysqli_query($this->mysqli_link_gps,'SET NAMES utf8;');
			return;
		}
		$this->mysqli_link=mysqli_connect($this->dbhost,$this->dbusername,$this->dbpassword) or die("<b>Could not connect:</b>".mysqli_error($this->mysqli_link));
		mysqli_query($this->mysqli_link,'SET NAMES utf8;');
	}
	
	public function get_io_settings(){
		$q = "SELECT * FROM `gps_io_settings` WHERE `active_flag` = 1";
		$result=mysqli_query($this->mysqli_link,$q);
		$this->io_settings=array();
		while ($row = mysqli_fetch_assoc($result)){
			$this->io_settings_write[$row['data_id']]=$row['write_always'];
			$this->io_settings[$row['data_id']]['multiplier']=$row['multiplier'];
		}
		$q = "SELECT * FROM `alarm_gps_settings`";
		$result=mysqli_query($this->mysqli_link,$q);
		$this->speed_limit=1000;
		$this->track_speed=true;
		while ($row = mysqli_fetch_assoc($result)){
			if ($row['name']=='vehicle_speed'){
				$this->speed_limit=1*$row['value'];
				if ($this->speed_limit < 40){
					$this->speed_limit=40;
				}
			}
			if ($row['name']=='dispatch_track_speed'){
				if ($row['value'] != 'true'){
					$this->track_speed=false;
				}
			}
		}
	}
	
	public function saveData($imei,$buffer,$buf_len){
		$imei_part=substr($imei,-4);
		if ($this->vehicle_debug_mode[$imei_part]==1){
			$ts=date('Y-m-d H:i:s');
			file_put_contents('log/'.$ts.'.bin',$buffer);
		}
		$this->checkTables($imei);
		$this->get_io_settings();
		$number_of_rows=$this->checkData($buffer,$buf_len);
		if ($number_of_rows > 0){
			$data_array=$this->process($buffer,$buf_len);
			$number_of_saved_rows=$this->saveRows($data_array,$imei);
			if ($number_of_saved_rows==($number_of_rows-$this->removed_rows_count)){
				$number_of_saved_rows=$number_of_rows;
			}
			return $number_of_rows;
		}
		return 0;
	}
	
	public function getFourByteString($number){
		$high_byte_mask=0xFF000000;
		$mid_hi_byte_mask=0x00FF0000;
		$mid_lo_byte_mask=0x0000FF00;
		$low_byte_mask=0x000000FF;
		$high_byte = ($number& $high_byte_mask)>>24;
		$mid_hi_byte = ($number& $mid_hi_byte_mask)>>16;
		$mid_lo_byte = ($number& $mid_lo_byte_mask)>>8;
		$low_byte = $number& $low_byte_mask;
		$result =  chr($high_byte) . chr($mid_hi_byte) . chr($mid_lo_byte) . chr($low_byte);
		return $result;
	}
	
	public function checkData($buffer,$buf_len){
		
		// first 4 bytes must be 0
		$test_num=ord($buffer[0])+ord($buffer[1])+ord($buffer[2])+ord($buffer[3]);
		if ($test_num > 0){
			// something's wrong, data not valid
			return 0;
		}
		
		// length of data part
		$data_length=16777216*ord($buffer[4])+65536*ord($buffer[5])+256*ord($buffer[6])+ord($buffer[7]);
		
		// this number must be 8 (defined in protocol, this is CodecId)
		/*
		 * this test must be skipped because not all devices are returnung 8
		 * 
		$test_num=ord($buffer[8]);
		if ($test_num != 8){
			// something's wrong, data not valid
			return 0;
		}
		*/
		
		$number_of_data=ord($buffer[9]);
		if ($number_of_data < 1){
			// no data, return
			return 0;
		}
		
		// this number musts be same as $number_of_data
		$number_of_data_2=ord($buffer[$buf_len-5]);
		if ($number_of_data_2 != $number_of_data){
			// something's wrong, data not valid
			return 0;
		}
		
		if ($buf_len != ($data_length+12)){
			// something's wrong, data not valid
			return 0;
		}
		
		// using crc 16 IBM format
		$crc16=256*ord($buffer[$buf_len-2])+ord($buffer[$buf_len-1]);
		$crc16_calculated=$this->crc16IBM(substr($buffer,8,$buf_len-12));
		if ($crc16 != $crc16_calculated){
			echo "crc16: ".$crc16.PHP_EOL;
			echo "crc16_calculated: ".$crc16_calculated.PHP_EOL;
			return 0;
		}
		return $number_of_data;
	}

	public function process($buffer,$buf_len){
		$return_array=array();
		$return_array_2=array();
//		$number_of_data=ord($buffer[9]);
//		$data_part_length=($buf_len-15);
		$actual_rows=substr($buffer,10,$buf_len-15);
		
		// find length of each data part
		$rows_array=array();
		$io_1_count_array=array();
		$io_2_count_array=array();
		$io_3_count_array=array();
		$io_4_count_array=array();
		while(true){
//			$number_of_io=ord($actual_rows[25]);
			$number_of_io_1=ord($actual_rows[26]);
			$length_of_io_1=$number_of_io_1*2;
			$number_of_io_2=ord($actual_rows[27+$length_of_io_1]);
			$length_of_io_2=$number_of_io_2*3;
			$number_of_io_3=ord($actual_rows[28+$length_of_io_1+$length_of_io_2]);
			$length_of_io_3=$number_of_io_3*5;
			$number_of_io_4=ord($actual_rows[29+$length_of_io_1+$length_of_io_2+$length_of_io_3]);
			$length_of_io_4=$number_of_io_4*9;
			$next_part=30+$length_of_io_1+$length_of_io_2+$length_of_io_3+$length_of_io_4;
			$rows_array[]=substr($actual_rows,0,$next_part);
			$io_1_count_array[]=$number_of_io_1;
			$io_2_count_array[]=$number_of_io_2;
			$io_3_count_array[]=$number_of_io_3;
			$io_4_count_array[]=$number_of_io_4;
			$actual_rows=substr($actual_rows,$next_part);
			if (strlen($actual_rows) < 25){
				break;
			}
		}

		foreach ($rows_array as $key=>$one_row_string){
			$fmt = 'Jtimestampn/Cpriority/Nlongitude/Nlatitude/naltitude/nangle/Csatellites/nspeed/';
			$one_row = unpack($fmt,$one_row_string);
			if ($one_row==false){
	//			$xx=file_put_contents ('bad_.bin', $buffer);
				// 32bit php version, J format is not supported, unpack data manually
				$fmt = 'Ntimestampn/Ntimestampn2/Cpriority/Nlongitude/Nlatitude/naltitude/nangle/Csatellites/nspeed/';
				$one_row = unpack($fmt,$one_row_string);
				$one_row['timestampn']=$one_row['timestampn']*4294967296+$one_row['timestampn2'];
			}
			$one_row['timestamp']=date('Y-m-d H:i:s',$one_row['timestampn']/1000);
			$one_row['longitude']=$one_row['longitude']/10000000;
			$one_row['latitude']=$one_row['latitude']/10000000;
			
			// IO 1 DATA (1 BYTE VALUES)
			if ($io_1_count_array[$key] > 0){
				foreach (range(0,$io_1_count_array[$key]-1) as $one_num){
					$event_id=ord($one_row_string[27+$one_num*2]);
					$event_value=ord($one_row_string[28+$one_num*2]);
					$one_row['io'][$event_id]=$event_value;
				}
			}
			
			// IO 2 DATA (2 BYTE VALUES)
			if ($io_2_count_array[$key] > 0){
				foreach (range(0,$io_2_count_array[$key]-1) as $one_num){
					$offset=$io_1_count_array[$key]*2+28;
					$event_id=ord($one_row_string[$offset+$one_num*3]);
					$event_value_1=ord($one_row_string[$offset+1+$one_num*3]);
					$event_value_2=ord($one_row_string[$offset+2+$one_num*3]);
					$one_row['io'][$event_id]=$event_value_1*256+$event_value_2;
				}
			}
			
			// IO 3 DATA (4 BYTE VALUES)
			if ($io_3_count_array[$key] > 0){
				foreach (range(0,$io_3_count_array[$key]-1) as $one_num){
					$offset=$io_1_count_array[$key]*2+$io_2_count_array[$key]*3+29;
					$event_id=ord($one_row_string[$offset+$one_num*5]);
					$event_value_1=ord($one_row_string[$offset+1+$one_num*5]);
					$event_value_2=ord($one_row_string[$offset+2+$one_num*5]);
					$event_value_3=ord($one_row_string[$offset+3+$one_num*5]);
					$event_value_4=ord($one_row_string[$offset+4+$one_num*5]);
					$one_row['io'][$event_id]=$event_value_1*16777216+$event_value_2*65536+$event_value_3*256+$event_value_4;
				}
			}
			
			// IO 4 DATA (8 BYTE VALUES)
			if ($io_4_count_array[$key] > 0){
				foreach (range(0,$io_4_count_array[$key]-1) as $one_num){
					$offset=$io_1_count_array[$key]*2+$io_2_count_array[$key]*3+$io_3_count_array[$key]*5+30;
					$event_id=ord($one_row_string[$offset+$one_num*9]);
					$event_value_1=ord($one_row_string[$offset+1+$one_num*9]);
					$event_value_2=ord($one_row_string[$offset+2+$one_num*9]);
					$event_value_3=ord($one_row_string[$offset+3+$one_num*9]);
					$event_value_4=ord($one_row_string[$offset+4+$one_num*9]);
					$event_value_5=ord($one_row_string[$offset+5+$one_num*9]);
					$event_value_6=ord($one_row_string[$offset+6+$one_num*9]);
					$event_value_7=ord($one_row_string[$offset+7+$one_num*9]);
					$event_value_8=ord($one_row_string[$offset+8+$one_num*9]);
					$event_value_1=$event_value_1*16777216+$event_value_2*65536+$event_value_3*256+$event_value_4;
					$event_value_5=$event_value_5*16777216+$event_value_6*65536+$event_value_7*256+$event_value_8;
					$one_row['io'][$event_id]=$event_value_1*4294967296+$event_value_5;
				}
			}
			$return_array[$one_row['timestamp']]=$one_row;
			$return_array_2[$one_row['timestampn']]=$one_row;
		}
		$this->removed_rows_count=count($return_array_2)-count($return_array);
		$last_row_array_for_current=array();
		ksort($return_array);
		if (count($return_array) > 2){
			$ee=end($return_array);
			$key=key($return_array);
			$ff=prev($return_array);
			$gg=prev($return_array);
			$diff1=$ee['timestampn']-$ff['timestampn'];
			$diff2=$ff['timestampn']-$gg['timestampn'];
			if ($diff1 > $diff2){
				// more check
				if (($diff1-$diff2) < 1001){
					$ctime=1000*time();
					if (($ctime-$ee['timestampn']) < 5000){
						// removing the last array element, because it will be sent again
						$last_row_array_for_current=array_splice($return_array,-1,1);
					}
				}
			}
		}
		return $return_array;
	}

	public function saveRows($data_array,$imei){
		$this->checkMYSQL();
		if ($this->ranges_loaded==0){
		    mysqli_select_db($this->mysqli_link,$this->dbname) or die ("2.saveRows($data_array,$imei), Database could not be found:</b>".mysqli_error($this->mysqli_link));
		    $q="SELECT `unique_id`,`range` FROM unique_station_id_local";
		    $result=mysqli_query($this->mysqli_link,$q);
		    while ($row = mysqli_fetch_assoc($result)){
		        $this->st_ranges[$row['unique_id']]=$row['range']/10000;
		    }
		    $this->ranges_loaded=1;
		}
		$res=mysqli_select_db($this->mysqli_link_gps,$this->dbname_gps);
		if (!$res){
			echo "1.saveRows($data_array,$imei), Database could not be found: ".mysqli_error($this->mysqli_link_gps);
			return 0;
		}
		$q="SELECT line_number,entered_departure_time FROM current WHERE garageNo='".$this->garage_no."'";
		$result=mysqli_query($this->mysqli_link_gps,$q);
		$row_cnt = mysqli_num_rows($result);
		$ln='';
		$edt='';
		if ($row_cnt > 0){
		    $ln = mysqli_fetch_assoc($result);
		    $edt=$ln['entered_departure_time'];
		    $ln=$ln['line_number'];
		}
		if (!isset($this->vehicles_lines[$this->garage_no])){
		    $this->vehicles_lines[$this->garage_no]=array();
		    $this->vehicles_lines[$this->garage_no][0]='';   // line number
		    $this->vehicles_lines[$this->garage_no][1]=0;    // start_time
		    $this->vehicles_lines[$this->garage_no][2]=0;    // last station
		    $this->vehicles_lines[$this->garage_no][3]=0;    // number of stations
		    $this->vehicles_lines[$this->garage_no][4]=0;    // last station time
		    $this->vehicles_lines[$this->garage_no][5]=0;    // last station uid
		    
		}
		if ($ln != ''){
		    if (($this->vehicles_lines[$this->garage_no][0] != $ln) || ($this->vehicles_lines[$this->garage_no][1] != $edt)){
		        $this->vehicles_lines[$this->garage_no][0]=$ln;
		        $this->vehicles_lines[$this->garage_no][1]=$edt;
		        $this->vehicles_lines[$this->garage_no][2]=1;
		        $loadline=0;
		        if (isset($this->lines[$ln])){
		            $tt=time();
		            $td=$tt-$this->lines[$ln][0];
		            if ($td > 3600){
		                $loadline=1;
		            }
		        } else {
		        	$loadline=1;
		        }
		        if ($loadline==1){
	               $filename=LOGS_LINES_DIRECTORY.$ln.".json";
	               $JsonFile=fopen($filename,"r");
	               if ($JsonFile==false){
	                   $station_data=array();
	                   $lnfd='';
	                   $difd='';
	               } else {
	                   $size=filesize($filename);
	                   $content=fread($JsonFile,$size);
	                   $station_data=json_decode($content,true);
	                   $lnfd=$station_data['line_number_for_display'];
	                   $difd=$station_data['direction_id_for_display'];
    	               $station_data=$station_data['stations'];
	               }
	               $this->lines[$ln]=array();
	               $this->lines[$ln][0]=time();
	               $this->lines[$ln][1]=$station_data;
	               $this->lines[$ln][2]=$lnfd;
	               $this->lines[$ln][3]=$difd;
		        }
		        $this->vehicles_lines[$this->garage_no][3]=count($this->lines[$ln][1]);
		        $this->vehicles_lines[$this->garage_no][4]=time();
		        $this->vehicles_lines[$this->garage_no][5]=$this->lines[$ln][1][1][0];
		    }
		} else {
		    if ($this->vehicles_lines[$this->garage_no][0] != ''){
		        $ln=$this->vehicles_lines[$this->garage_no][0];
		        $edt=$this->vehicles_lines[$this->garage_no][1];
		    }
		}
		$counter=0;
		$driver_found=0;
		$driverCardSerialNumber=0;
		foreach ($data_array as $one_row){
		    $in_range=0;
		    $in_range_uid=0;
		    if ($ln != ''){
		        $ls=$this->vehicles_lines[$this->garage_no][2];
		        $num_f=0;
		        for($f=$ls;$f <= $this->vehicles_lines[$this->garage_no][3];$f++){
		            $num_f++;
		            if ($num_f > 2){
		                break;
		            }
		            $ts=$this->lines[$ln][1][$f];
		            $rng=$this->st_ranges[$ts[0]];
		            $dlat1=$one_row['latitude']-$rng;
		            $dlat2=$one_row['latitude']+$rng;
		            if ($ts[2] >= $dlat1){
		              if ($ts[2] <= $dlat2){
		                  $dlon1=$one_row['longitude']-$rng;
		                  $dlon2=$one_row['longitude']+$rng;
		                  if ($ts[3] >= $dlon1){
		                      if ($ts[3] <= $dlon2){
		                          $in_range=1;
		                          $in_range_uid=$ts[0];
		                          if ($f > $this->vehicles_lines[$this->garage_no][2]){
		                              $tis_new=strtotime($one_row['timestamp']);
		                              if ($f == $this->vehicles_lines[$this->garage_no][2]+1){
		                                  $tis=$tis_new-$this->vehicles_lines[$this->garage_no][4];
		                                  if ($tis > 20){
		                                      $q="INSERT INTO `between_stations_time` SET station1_uid='".$this->vehicles_lines[$this->garage_no][5]."',station2_uid='".$in_range_uid."',garage_no='".$this->garage_no."',time_in_seconds='".$tis."',line_no_fd='".$this->lines[$ln][2]."',direction_fd='".$this->lines[$ln][3]."'";
		                                      $result=mysqli_query($this->mysqli_link_gps,$q);
		                                  }
		                              }
		                              $this->vehicles_lines[$this->garage_no][4]=$tis_new;
		                              $this->vehicles_lines[$this->garage_no][5]=$in_range_uid;
		                              $this->vehicles_lines[$this->garage_no][2]=$f;
		                          } else {
		                              if ($f==1){
		                                  $tis_new=strtotime($one_row['timestamp']);
		                                  $this->vehicles_lines[$this->garage_no][4]=$tis_new;
		                              }
		                          }
		                          break;
		                      }
		                  }
		              }
		           }
		        }
		    }
		    $q="INSERT INTO `".$this->garage_no."gps` SET captured='".$one_row['timestamp']."',lat='".$one_row['latitude']."',lng='".$one_row['longitude']."',course='".$one_row['angle']."',speed='".$one_row['speed']."',alt='".$one_row['altitude']."',`inroute`='".$in_range_uid."',`state`='".$in_range."'";
			$result=mysqli_query($this->mysqli_link_gps,$q);
			if ($result){
				$counter++;
			} else {
				$error=mysqli_error($this->mysqli_link_gps);
				if (substr($error,0,9)=='Duplicate'){
					$counter++;
				}
			}
			if ($this->track_speed == true){
				if ((1*$one_row['speed']) > $this->speed_limit){
					if ($driver_found==0){
						$driver_found=1;
						$q="SELECT driverCardSerialNumber FROM current WHERE garageNo='".$this->garage_no."'";
						$result=mysqli_query($this->mysqli_link_gps,$q);
						$row_cur = mysqli_num_rows($result);
						$driverCardSerialNumber=0;
						if ($row_cur > 0){
							$value = mysqli_fetch_assoc($result);
							$driverCardSerialNumber=$value['driverCardSerialNumber'];
						}
					}
					$q="INSERT INTO `gps_speeding` SET driver_id_card_sn=".$driverCardSerialNumber.",garage_number='".$this->garage_no."',create_date_time='".$one_row['timestamp']."',`speed`='".$one_row['speed']."',`x_coordinate`='".$one_row['latitude']."',y_coordinate='".$one_row['longitude']."'";
					$result=mysqli_query($this->mysqli_link_gps,$q);
				}
			}
			$imei_part=substr($imei,-4);
			$io_query=array();
			if (isset($one_row['io'])){
				if (count($one_row['io']) > 0){
					foreach ($one_row['io'] as $event_id=>$event_value){
						if ($this->vehicle_debug_mode[$imei_part]==1){
							$q="INSERT INTO `".$this->garage_no."debug` SET garageNo='".$this->garage_no."',captured='".$one_row['timestamp']."',`type`='IO',`data`='".$event_id."',data1='".$event_value."'";
							$result=mysqli_query($this->mysqli_link_gps,$q);
						}
						if (isset($this->io_settings[$event_id]['multiplier'])){
							$insert_flag=true;
							if ($this->io_settings_write[$event_id]==0){
								if (isset($this->gb_io_cache[$this->garage_no][$event_id])){
									if ($this->gb_io_cache[$this->garage_no][$event_id] == $event_value){
										$insert_flag=false;
									}
								}
							}
							if ($insert_flag==true){
								$final_value=$this->io_settings[$event_id]['multiplier']*$event_value;
								$io_query[]="('".$one_row['timestamp']."',".$event_id.",".$final_value.")";
								$this->gb_io_cache[$this->garage_no][$event_id]=$event_value;
                                $this->gb_io_current_cache[$this->garage_no][$event_id]=[$event_value,$one_row['timestamp']];
							}
						}
					}
				}
			}
			if (count($io_query) > 0){
				$io_query=implode(",", $io_query);
				$q="INSERT INTO `".$this->garage_no."iot` (`captured`,`type`,`data`) VALUES ".$io_query;
				$result=mysqli_query($this->mysqli_link_gps,$q);
				if (!$result){
					$q2="CREATE TABLE IF NOT EXISTS `".$this->garage_no."iot` LIKE `template_iot`";
					$result=mysqli_query($this->mysqli_link_gps,$q2);
					if ($result){
						$result=mysqli_query($this->mysqli_link_gps,$q);
					}
				}
			}
		}
        $voltage="";
        $voltageDate="0000-00-00 00:00:00";
        if(isset($this->gb_io_current_cache[$this->garage_no][67])){
           $voltage=$this->gb_io_current_cache[$this->garage_no][67][0];
           $voltageDate=$this->gb_io_current_cache[$this->garage_no][67][1];
        }
        $ignition="";
        $ignitionDate="0000-00-00 00:00:00";
        if(isset($this->gb_io_current_cache[$this->garage_no][239])){
           $ignition=$this->gb_io_current_cache[$this->garage_no][239][0];
           $ignitionDate=$this->gb_io_current_cache[$this->garage_no][239][1];
        }
        $iotExternalVolt ="";
        $iotExternalVoltDatetime="0000-00-00 00:00:00";
        if(isset($this->gb_io_current_cache[$this->garage_no][66])){
           $iotExternalVolt=$this->gb_io_current_cache[$this->garage_no][66][0];
           $iotExternalVoltDatetime=$this->gb_io_current_cache[$this->garage_no][66][1];
        }
		$imei_part=substr($imei,-6);
		if ($row_cnt > 0){
			$q="UPDATE current SET `lat`='".$one_row['latitude']."',`lng`='".$one_row['longitude']."',course='".$one_row['angle']."',captured='".$one_row['timestamp']."',speed='".$one_row['speed']."',alt='".$one_row['altitude']."',busInfoSerialNumber='".$imei_part."' ";
            if($voltage !== "" && $voltage !== 0 && $voltage !== '0'){
               $q.=" ,iot_voltage='".$voltage."', iot_voltage_datetime='".$voltageDate."' ";
            }
            $q.=" , iot_ignition='".$ignition."', iot_ignition_datetime='".$ignitionDate."', iot_external_volt='".$iotExternalVolt."', iot_external_volt_datetime='".$iotExternalVoltDatetime."',bm_edited=NOW() WHERE garageNo='".$this->garage_no."'";
            $result=mysqli_query($this->mysqli_link_gps,$q);
		} else {
			$q="INSERT INTO current SET garageNo='".$this->garage_no."',`lat`='".$one_row['latitude']."',`lng`='".$one_row['longitude']."',course='".$one_row['angle']."',captured='".$one_row['timestamp']."',speed='".$one_row['speed']."',alt='".$one_row['altitude']."',iot_voltage='".$voltage."', iot_voltage_datetime='".$voltageDate."', iot_ignition='".$ignition."', iot_ignition_datetime='".$ignitionDate."', iot_external_volt='".$iotExternalVolt."', iot_external_volt_datetime='".$iotExternalVoltDatetime."',busInfoSerialNumber='".$imei_part."',bm_edited=NOW() ";
			$result=mysqli_query($this->mysqli_link_gps,$q);
		}
		mysqli_select_db($this->mysqli_link,$this->dbname) or die ("2.saveRows($data_array,$imei), Database could not be found:</b>".mysqli_error($this->mysqli_link));
		return $counter;
	}
	
	public function checkTables($imei){
		$this->checkMYSQL();
		$pib=$this->checkDeviceOperaters($imei);
		if (!$pib){return 0;}
		if ($this->host == '79.101.48.11'){
		    $this->dbname=$pib."gps";
		} else {
		    $this->dbname=$pib;
		}
		$this->dbname_gps=$pib."gps";
		mysqli_select_db($this->mysqli_link,$this->dbname) or die ("2.saveRows($imei), Database could not be found:</b>".mysqli_error($this->mysqli_link));
		$q = "SELECT garazni_broj FROM `bus_vehicle` WHERE `imei` = '$imei'";
		$result=mysqli_query($this->mysqli_link,$q);
		$row_cnt = mysqli_num_rows($result);
		if ($row_cnt > 0){
			$value = mysqli_fetch_assoc($result);
			$garage_no=$value['garazni_broj'];
			$this->garage_no=$garage_no;
			if (!in_array($this->garage_no,$this->gnos)){
				$this->gnos[]=$this->garage_no;
				echo $this->garage_no.PHP_EOL;
			}
		} else {
			// imei not assigned to vehicle, save to unassigned_imei tables
			$garage_no='unassigned_imei_'.$imei."_";
			$this->garage_no=$garage_no;
		}
		$this->vehicle_debug_mode= array();
		mysqli_select_db($this->mysqli_link_gps,$this->dbname_gps) or die ("1.checkTables($imei), Database could not be found:</b>".mysqli_error($this->mysqli_link_gps));
		if (!isset($this->vehicles_with_tables[$garage_no])){
			$q="SHOW TABLES LIKE '".$garage_no."gps'";
			$result=mysqli_query($this->mysqli_link_gps,$q);
			$row_cnt = mysqli_num_rows($result);
			$this->vehicles_with_tables[$garage_no]=1;
			if ($row_cnt < 1){
				// create set of tables
				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."` LIKE `template`";
				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."debug` LIKE `debug`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."acc` LIKE `template_acc`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."bat` LIKE `template_bat`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."can` LIKE `template_can`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."cmnt` LIKE `template_cmnt`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."gps` LIKE `template_gps`";
				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."io` LIKE `template_io`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."iot` LIKE `template_iot`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."lin` LIKE `template_lin`";
				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."state` LIKE `template_state`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."terminal_acc` LIKE `template_terminal_acc`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
//				$q="CREATE TABLE IF NOT EXISTS `".$garage_no."time` LIKE `template_time`";
//				$result=mysqli_query($this->mysqli_link_gps,$q);
			}
		}
		mysqli_select_db($this->mysqli_link,$this->dbname) or die ("2.checkTables($imei), Database could not be found:</b>".mysqli_error($this->mysqli_link));
	}
	
	public function checkIMEI($imei){
		$this->checkMYSQL();
		$pib=$this->checkDeviceOperaters($imei);
		if (!$pib){echo 'bad pib';return 0;}
		$this->dbname=$pib;
		$this->dbname_gps=$pib."gps";
		$q = "SELECT garazni_broj FROM `bus_vehicle` WHERE `imei` = '".$imei."'";
		$result=mysqli_query($this->mysqli_link,$q);
		$row_cnt = mysqli_num_rows($result);
		if ($row_cnt > 0){
			return 1;
		}
	//	echo $q;
	// imei not found in bus_vehicle table
		return 2;
	}
	
	public function checkDeviceOperaters($imei){
		if (count($this->device_operaters_array) < 1){
			$this->getDeviceOperaters();
		} else {
			$tst=microtime(true);
			$diff=$tst-$this->get_device_operaters_time;
			if ($diff > 370){
				$this->getDeviceOperaters();
			}
		}
		if (!isset($this->device_operaters_array[$imei])){
			echo '!isset($this->device_operaters_array['.$imei.'])';
			return false;
		}
		$pib=$this->device_operaters_array[$imei];
		if ($pib=='pib113402218'){
			$pib='pib100065430';
		}
		if ($this->host == '79.101.48.11'){
		    $res=mysqli_select_db($this->mysqli_link,$pib."gps");
		    $res=mysqli_select_db($this->mysqli_link_gps,$pib."gps");
		} else {
            $res=mysqli_select_db($this->mysqli_link,$pib);
		}
		if (!$res){
			echo "checkDeviceOperaters($imei), Database could not be found: ".DB_SERVER."   -   ".$this->dbhost."   ---   ".mysqli_error($this->mysqli_link);
			return false;
		}
		return $pib;
	}
	
	public function getDeviceOperaters(){
	    if ($this->host == '79.101.48.11'){
	        mysqli_select_db($this->mysqli_link_gps,"pib100065430gps") or die ("Database could not be found:</b>".mysqli_error($this->mysqli_link_gps));
	        $q = "SELECT * FROM `devices_operaters`";
	        $result=mysqli_query($this->mysqli_link_gps,$q);
	        if (!$result){
	            echo "getDeviceOperaters() Bad result ".mysqli_error($this->mysqli_link_gps);
	            echo $this->host;
	            echo $q;
	            $this->get_device_operaters_time=microtime(true);
	            return false;
	        }
	    } else {
            $q = "SELECT device,pib FROM ".DB_GLOBAL.".`devices_operaters` WHERE `active_modem`=1";
            $result=mysqli_query($this->mysqli_link,$q);
            if (!$result){
                echo "getDeviceOperaters() Bad result ".mysqli_error($this->mysqli_link);
                echo $this->host;
                echo $q;
                $this->get_device_operaters_time=microtime(true);
                return false;
            }
	    }
		$this->device_operaters_array=array();
		while ($row = mysqli_fetch_assoc($result)){
			$this->device_operaters_array[$row['device']]='pib'.$row['pib'];
		}
		$this->get_device_operaters_time=microtime(true);
	}
	
	public function crc16IBM($string, $crc = 0) {
		for ($x = 0; $x < strlen($string); $x++) {
			$crc = $crc ^ ord($string[$x]);
			for ($y = 0; $y < 8; $y++) {
				if (($crc & 0x0001) == 0x0001) {
					$crc = (($crc >> 1) ^ 0xA001);
				} else {
					$crc = $crc >> 1;
				}
			}
		}
		return $crc;
	}
}