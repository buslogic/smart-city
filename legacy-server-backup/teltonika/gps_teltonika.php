<?php
set_time_limit(0);
ini_set("log_errors", 1);
ini_set('mysql.connect_timeout', 0);
error_log( "Hello, errors!",3, "/tmp/php-error.log");
require_once 'dbcred.inc.php';
require_once 'util_teltonika.php';

class SocketServer{
	protected $socket;
	protected $clients = [];
	protected $client_imeis = [];
	protected $changed;
	public $mysqli_link;
	public $mysqli_link_gps;
	public $util_class;
	
	function __construct($host,$port,$dbhost,$dbusername,$dbpassword,$dbhost_gps, $dbusername_gps, $dbpassword_gps){
		$socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
		socket_set_option($socket, SOL_SOCKET, SO_REUSEADDR, 1);
		socket_bind($socket, 0, $port);
		socket_listen($socket,SOMAXCONN);
		$this->socket = $socket;
		if ($host=='79.101.48.11'){
		    $this->mysqli_link_gps=mysqli_connect($dbhost_gps,$dbusername_gps,$dbpassword_gps) or die("<b>Could not connect:</b>".mysqli_error($this->mysqli_link_gps));
		    mysqli_query($this->mysqli_link_gps,'SET NAMES utf8;');
		    mysqli_select_db($this->mysqli_link_gps,"pib100065430gps");
		    $this->util_class=new util_teltonika($this->mysqli_link_gps,$dbhost_gps,$dbusername_gps,$dbpassword_gps,$this->mysqli_link_gps,$dbhost_gps,$dbusername_gps,$dbpassword_gps,$host);
		    echo "host 1".PHP_EOL;
		} else {
		    $this->mysqli_link=mysqli_connect($dbhost,$dbusername,$dbpassword) or die("<b>Could not connect:</b>".mysqli_error($this->mysqli_link));
		    mysqli_query($this->mysqli_link,'SET NAMES utf8;');
		    $this->mysqli_link_gps=mysqli_connect($dbhost_gps,$dbusername_gps,$dbpassword_gps) or die("<b>Could not connect:</b>".mysqli_error($this->mysqli_link_gps));
		    mysqli_query($this->mysqli_link_gps,'SET NAMES utf8;');
		    $this->util_class=new util_teltonika($this->mysqli_link,$dbhost,$dbusername,$dbpassword,$this->mysqli_link_gps,$dbhost_gps,$dbusername_gps,$dbpassword_gps,$host);
		    echo "host 2".PHP_EOL;
		}
	}
	
	function __destruct(){
		foreach($this->clients as $client) {
			socket_close($client);
		}
		socket_close($this->socket);
	}
	
	function run(){
		while(true) {
		//	echo "wfc".PHP_EOL;
			$this->waitForChange();
 	//		echo "cnc".PHP_EOL;
			$this->checkNewClients();
	//		echo "cmr".PHP_EOL;
			$this->checkMessageRecieved();
	//		echo "cdi".PHP_EOL;
			$this->checkDisconnect();
		}
	}
	
	function checkDisconnect(){
		foreach ($this->changed as $changed_socket) {
			$buf = @socket_read($changed_socket, 1024, PHP_NORMAL_READ);
			if ($buf !== false) {
				continue;
			}
//			echo "diss".PHP_EOL;
			$found_socket = array_search($changed_socket, $this->clients);
			unset($this->clients[$found_socket]);
			unset($this->client_imeis[$found_socket]);
		}
	}
	
	
	public function checkDisconnect_new() {
	    $disconnected_sockets = [];
	    
	    // First identify all disconnected sockets
	    foreach ($this->changed as $changed_socket) {
	        // Check if socket is still valid
	        if (!is_resource($changed_socket)) {
	            $disconnected_sockets[] = $changed_socket;
	            continue;
	        }
	        
	        // Try to read from socket with proper error handling
	        try {
	            $buf = @socket_read($changed_socket, 1024, PHP_NORMAL_READ);
	            $socket_error = socket_last_error($changed_socket);
	            
	            // Check for disconnection conditions
	            if ($buf === false || $socket_error !== 0) {
	                // Connection lost or error
	                $disconnected_sockets[] = $changed_socket;
	                socket_clear_error($changed_socket);
	            }
	        } catch (Exception $e) {
	            $disconnected_sockets[] = $changed_socket;
	            error_log("Socket error: " . $e->getMessage());
	        }
	    }
	    
	    // Now safely remove all disconnected sockets
	    foreach ($disconnected_sockets as $socket) {
	        // Find and remove from clients array
	        $found_socket = array_search($socket, $this->clients);
	        if ($found_socket !== false) {
	            // Log disconnection with client info
	            $client_imei = isset($this->client_imeis[$found_socket]) ? $this->client_imeis[$found_socket] : 'unknown';
	            error_log(date('Y-m-d H:i:s') . " Client disconnected - IMEI: " . $client_imei);
	            
	            // Clean up socket
	            if (is_resource($socket)) {
	                socket_close($socket);
	            }
	            
	            // Remove from tracking arrays
	            unset($this->clients[$found_socket]);
	            unset($this->client_imeis[$found_socket]);
	            
	            // Remove from changed array if present
	            $changed_key = array_search($socket, $this->changed);
	            if ($changed_key !== false) {
	                unset($this->changed[$changed_key]);
	            }
	        }
	    }
	    
	    // Reindex arrays to prevent fragmentation
	    $this->clients = array_values($this->clients);
	    $this->client_imeis = array_values($this->client_imeis);
	    $this->changed = array_values($this->changed);
	}

	function checkMessageRecieved(){
		foreach ($this->changed as $key => $socket) {
			$buffer = null;
			while(socket_recv($socket, $buffer, 1048576, 0) >= 1) {
				$buf_len=strlen($buffer);
				if ($buf_len > 0){
					foreach ($this->clients as $key_cl=>$one_socket){
						if ($one_socket==$socket){
							$imei=$this->client_imeis[$key_cl];
							break;
						}
					}
					if ($imei != ''){
		//				echo $imei.PHP_EOL;
						$number_of_data_saved=$this->util_class->saveData($imei,$buffer,$buf_len);
						$answer=$this->util_class->getFourByteString($number_of_data_saved);
						socket_write($socket,$answer);
					}
				}
				unset($this->changed[$key]);
				break;
			}
		}
	}

	function waitForChange(){
		$this->changed = array_merge([$this->socket], $this->clients);
		$null = null;
		$res=socket_select($this->changed, $null, $null, null);
//		echo "ssel".PHP_EOL;
		if ($res===false){
			echo socket_last_error();
		}
	}
	
	function checkNewClients(){
		if (!in_array($this->socket, $this->changed)) {
			return;
		}
//		echo "sac".PHP_EOL;
		$socket_new = socket_accept($this->socket);
//		echo "sace".PHP_EOL;
		if ($socket_new===false){
			$err=socket_last_error($this->socket);
			echo "err 1 : ".socket_strerror($err).PHP_EOL;
			return;
		}

		$address='';
		socket_getpeername($socket_new,$address,$port);
//		echo date("Y-m-d H:i:s")." addr= ".$address.":".$port.PHP_EOL;
		
		$buffer = null;
		$rr=array();
		$rr[]=$socket_new;
		$ssel=socket_select($rr, $null, $null,0,200000);
		if ($ssel===false){
			$err=socket_last_error($socket_new);
			echo date("Y-m-d H:i:s")."ssel err: ".socket_strerror($err).PHP_EOL;
			socket_close($socket_new);
			return;
		}
		if ($ssel===0){
			$err=socket_last_error($socket_new);
			echo date("Y-m-d H:i:s")."ssel err 0: ".socket_strerror($err).PHP_EOL;
			socket_close($socket_new);
			return;
		}
		
		
		$xx=socket_recv($socket_new, $buffer, 1, 0);
		if ($xx != 1){
			echo date("Y-m-d H:i:s")."err num bytes1 ".$xx.PHP_EOL;
			socket_close($socket_new);
			return;
		}
		if (ord($buffer) != 0){
			echo date("Y-m-d H:i:s")." err ord1 ".ord($buffer).PHP_EOL;
			socket_close($socket_new);
			return;
		}
//		echo "sr2 ".PHP_EOL;
		$buffer = null;
		$xx=socket_recv($socket_new, $buffer, 1, 0);
		if ($xx != 1){
			echo date("Y-m-d H:i:s")." err num bytes2 ".$xx.PHP_EOL;
			socket_close($socket_new);
			return;
		}
		if (ord($buffer) != 15){
			echo date("Y-m-d H:i:s")." err ord2 ".ord($buffer).PHP_EOL;
			socket_close($socket_new);
			return;
		}

		
//		echo "sr15 ".PHP_EOL;
		$first_line = null;
 		$xx=socket_recv($socket_new, $first_line, 15, 0);
		if ($xx != 15){
			echo date("Y-m-d H:i:s")." err num bytes15 ".$xx.PHP_EOL;
			socket_close($socket_new);
			return;
		}
//		$first_line=substr($buffer,2);
//		echo date("Y-m-d H:i:s")." imei= ".$first_line.PHP_EOL;
		$valid_imei=$this->checkIMEI($first_line);
		if ($valid_imei==1){
			$this->clients[] = $socket_new;
			$this->client_imeis[] = $first_line;
			$answer=chr(1);
//			echo "swa".PHP_EOL;
			socket_write($socket_new,$answer);
//			echo "swb".PHP_EOL;
		} else {
			echo date("Y-m-d H:i:s")." imei= ".$first_line.PHP_EOL;
			echo "vali= ".$valid_imei.PHP_EOL;
			$answer=chr(0);
			echo "swc".PHP_EOL;
			echo "err ".$first_line.PHP_EOL;
			socket_write($socket_new,$answer);
			socket_close($socket_new);
		}
//		echo "uns".PHP_EOL;
		unset($this->changed[0]);
	}
	
	function checkIMEI($imei){
		return $this->util_class->checkIMEI($imei);
	}
}
(new SocketServer($server_address,$port_address,$dbhost, $dbusername, $dbpassword,$dbhost_gps, $dbusername_gps, $dbpassword_gps))->run();
?>